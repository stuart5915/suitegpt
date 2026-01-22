-- SUITE Widget System - Lists Tables Migration
-- Creates tables for shared tasks/groceries lists with widget integration

-- =============================================
-- LISTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS suite_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('tasks', 'groceries', 'custom')),
    icon TEXT DEFAULT '📝',
    owner_id UUID REFERENCES factory_users(id) ON DELETE CASCADE,
    is_shared BOOLEAN DEFAULT false,
    share_code TEXT UNIQUE,  -- For invite links (e.g., abc123)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster lookup by owner
CREATE INDEX idx_suite_lists_owner ON suite_lists(owner_id);
-- Index for share code lookup
CREATE INDEX idx_suite_lists_share_code ON suite_lists(share_code) WHERE share_code IS NOT NULL;

-- =============================================
-- LIST ITEMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS suite_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID REFERENCES suite_lists(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    added_by UUID REFERENCES factory_users(id) ON DELETE SET NULL,
    completed_by UUID REFERENCES factory_users(id) ON DELETE SET NULL,
    position INTEGER DEFAULT 0,  -- For ordering items
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Index for faster lookup by list
CREATE INDEX idx_suite_list_items_list ON suite_list_items(list_id);
-- Index for incomplete items (most common query)
CREATE INDEX idx_suite_list_items_incomplete ON suite_list_items(list_id, is_completed) WHERE is_completed = false;

-- =============================================
-- LIST MEMBERS TABLE (for sharing)
-- =============================================
CREATE TABLE IF NOT EXISTS suite_list_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID REFERENCES suite_lists(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES factory_users(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(list_id, user_id)
);

-- Index for user's lists lookup
CREATE INDEX idx_suite_list_members_user ON suite_list_members(user_id);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE suite_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE suite_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suite_list_members ENABLE ROW LEVEL SECURITY;

-- LISTS: Users can see lists they own or are members of
CREATE POLICY "lists_select_own_or_member" ON suite_lists
    FOR SELECT USING (
        owner_id = auth.uid()::uuid
        OR id IN (
            SELECT list_id FROM suite_list_members
            WHERE user_id = auth.uid()::uuid
        )
    );

-- LISTS: Users can insert their own lists
CREATE POLICY "lists_insert_own" ON suite_lists
    FOR INSERT WITH CHECK (owner_id = auth.uid()::uuid);

-- LISTS: Only owners can update their lists
CREATE POLICY "lists_update_owner" ON suite_lists
    FOR UPDATE USING (owner_id = auth.uid()::uuid);

-- LISTS: Only owners can delete their lists
CREATE POLICY "lists_delete_owner" ON suite_lists
    FOR DELETE USING (owner_id = auth.uid()::uuid);

-- LIST ITEMS: Users can see items in lists they have access to
CREATE POLICY "items_select_member" ON suite_list_items
    FOR SELECT USING (
        list_id IN (
            SELECT id FROM suite_lists WHERE owner_id = auth.uid()::uuid
            UNION
            SELECT list_id FROM suite_list_members WHERE user_id = auth.uid()::uuid
        )
    );

-- LIST ITEMS: Members can add items to lists they have access to
CREATE POLICY "items_insert_member" ON suite_list_items
    FOR INSERT WITH CHECK (
        list_id IN (
            SELECT id FROM suite_lists WHERE owner_id = auth.uid()::uuid
            UNION
            SELECT list_id FROM suite_list_members WHERE user_id = auth.uid()::uuid
        )
    );

-- LIST ITEMS: Members can update items (mark complete, etc)
CREATE POLICY "items_update_member" ON suite_list_items
    FOR UPDATE USING (
        list_id IN (
            SELECT id FROM suite_lists WHERE owner_id = auth.uid()::uuid
            UNION
            SELECT list_id FROM suite_list_members WHERE user_id = auth.uid()::uuid
        )
    );

-- LIST ITEMS: Members can delete items
CREATE POLICY "items_delete_member" ON suite_list_items
    FOR DELETE USING (
        list_id IN (
            SELECT id FROM suite_lists WHERE owner_id = auth.uid()::uuid
            UNION
            SELECT list_id FROM suite_list_members WHERE user_id = auth.uid()::uuid
        )
    );

-- LIST MEMBERS: Users can see members of lists they have access to
CREATE POLICY "members_select" ON suite_list_members
    FOR SELECT USING (
        list_id IN (
            SELECT id FROM suite_lists WHERE owner_id = auth.uid()::uuid
            UNION
            SELECT list_id FROM suite_list_members WHERE user_id = auth.uid()::uuid
        )
    );

-- LIST MEMBERS: Only owners can add members
CREATE POLICY "members_insert_owner" ON suite_list_members
    FOR INSERT WITH CHECK (
        list_id IN (SELECT id FROM suite_lists WHERE owner_id = auth.uid()::uuid)
    );

-- LIST MEMBERS: Only owners can remove members (or users can remove themselves)
CREATE POLICY "members_delete_owner_or_self" ON suite_list_members
    FOR DELETE USING (
        list_id IN (SELECT id FROM suite_lists WHERE owner_id = auth.uid()::uuid)
        OR user_id = auth.uid()::uuid
    );

-- =============================================
-- SERVICE ROLE BYPASS (for edge functions)
-- =============================================
-- Note: Edge functions use service_role key which bypasses RLS
-- This is intentional as edge functions handle their own auth

-- =============================================
-- AUTO-CREATE DEFAULT LISTS TRIGGER
-- =============================================
-- When a new user signs up, create default Tasks and Groceries lists

CREATE OR REPLACE FUNCTION create_default_lists()
RETURNS TRIGGER AS $$
BEGIN
    -- Create default Tasks list
    INSERT INTO suite_lists (name, type, icon, owner_id)
    VALUES ('Today', 'tasks', '✅', NEW.id);

    -- Create default Groceries list
    INSERT INTO suite_lists (name, type, icon, owner_id)
    VALUES ('Groceries', 'groceries', '🛒', NEW.id);

    -- Add owner as member of both lists
    INSERT INTO suite_list_members (list_id, user_id, role)
    SELECT id, NEW.id, 'owner' FROM suite_lists WHERE owner_id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-creating default lists
DROP TRIGGER IF EXISTS create_default_lists_trigger ON factory_users;
CREATE TRIGGER create_default_lists_trigger
    AFTER INSERT ON factory_users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_lists();

-- =============================================
-- HELPER FUNCTION: Generate share code
-- =============================================
CREATE OR REPLACE FUNCTION generate_share_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION update_suite_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS suite_lists_updated_at ON suite_lists;
CREATE TRIGGER suite_lists_updated_at
    BEFORE UPDATE ON suite_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_suite_lists_updated_at();
