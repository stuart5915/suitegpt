/**
 * WorkConductor - Goals Manager
 * Handles parsing, updating, and persisting hierarchical goals
 */

const GoalsManager = (function () {
    // Goal structure stored in memory
    let goalsData = {
        sections: [],
        raw: ''
    };

    /**
     * Parse markdown-style goals into hierarchical structure
     */
    function parseGoals(markdownText) {
        const lines = markdownText.split('\n');
        const sections = [];
        let currentSection = null;
        let currentSubsection = null;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // H1 or H2 = new section
            if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
                const title = trimmed.replace(/^#+\s*/, '');
                currentSection = {
                    id: generateId(),
                    title: title,
                    items: [],
                    collapsed: false
                };
                sections.push(currentSection);
                currentSubsection = null;
                continue;
            }

            // H3 = subsection (treated as a special item)
            if (trimmed.startsWith('### ')) {
                const title = trimmed.replace(/^###\s*/, '');
                if (currentSection) {
                    currentSubsection = {
                        id: generateId(),
                        text: title,
                        status: 'pending',
                        isSubsection: true,
                        items: []
                    };
                    currentSection.items.push(currentSubsection);
                }
                continue;
            }

            // List items
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.match(/^\d+\.\s/)) {
                const text = trimmed.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '');
                const item = parseGoalItem(text);

                if (currentSubsection) {
                    currentSubsection.items.push(item);
                } else if (currentSection) {
                    currentSection.items.push(item);
                } else {
                    // No section yet, create a default one
                    currentSection = {
                        id: generateId(),
                        title: 'Goals',
                        items: [],
                        collapsed: false
                    };
                    sections.push(currentSection);
                    currentSection.items.push(item);
                }
                continue;
            }

            // Plain text paragraphs - add as a description/context item
            if (currentSection && trimmed.length > 0) {
                // Skip only table formatting lines
                if (trimmed.startsWith('|')) continue;
                if (trimmed === '---' || trimmed === '***' || trimmed.match(/^[-]{3,}$/)) continue;

                // Add as a context item (not a task)
                const contextItem = {
                    id: generateId(),
                    text: trimmed,
                    status: 'context', // Special status for non-task items
                    isContext: true
                };
                currentSection.items.push(contextItem);
            }
        }

        goalsData = {
            sections: sections,
            raw: markdownText
        };

        saveGoals();
        return goalsData;
    }

    /**
     * Parse a single goal item, extracting status markers
     */
    function parseGoalItem(text) {
        let status = 'pending';
        let cleanText = text;

        // Check for status markers
        if (text.startsWith('[x] ') || text.startsWith('[X] ')) {
            status = 'completed';
            cleanText = text.substring(4);
        } else if (text.startsWith('[/] ')) {
            status = 'in-progress';
            cleanText = text.substring(4);
        } else if (text.startsWith('[ ] ')) {
            status = 'pending';
            cleanText = text.substring(4);
        } else if (text.startsWith('[!] ')) {
            status = 'blocked';
            cleanText = text.substring(4);
        } else if (text.includes('✅') || text.includes('Done') || text.includes('done')) {
            status = 'completed';
            cleanText = text.replace('✅', '').trim();
        } else if (text.includes('🔧') || text.includes('In Progress') || text.includes('WIP')) {
            status = 'in-progress';
        } else if (text.includes('🚧') || text.includes('Blocked')) {
            status = 'blocked';
        }

        // Extract percentage if present
        const percentMatch = cleanText.match(/(\d+)%/);
        const percent = percentMatch ? parseInt(percentMatch[1]) : null;

        if (percent !== null) {
            if (percent >= 100) status = 'completed';
            else if (percent > 0) status = 'in-progress';
        }

        return {
            id: generateId(),
            text: cleanText,
            status: status,
            percent: percent
        };
    }

    /**
     * Generate a unique ID
     */
    function generateId() {
        return 'goal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get all goals
     */
    function getGoals() {
        return goalsData;
    }

    /**
     * Find a goal by text (fuzzy match)
     */
    function findGoal(searchText) {
        const searchLower = searchText.toLowerCase();

        for (const section of goalsData.sections) {
            for (const item of section.items) {
                if (item.text.toLowerCase().includes(searchLower)) {
                    return { section, item };
                }
                // Check subsection items
                if (item.items) {
                    for (const subItem of item.items) {
                        if (subItem.text.toLowerCase().includes(searchLower)) {
                            return { section, item: subItem, parent: item };
                        }
                    }
                }
            }
        }
        return null;
    }

    /**
     * Mark a goal as completed
     */
    function completeGoal(searchText) {
        const found = findGoal(searchText);
        if (found) {
            found.item.status = 'completed';
            saveGoals();
            return found.item;
        }
        return null;
    }

    /**
     * Mark a goal as in-progress
     */
    function startGoal(searchText) {
        const found = findGoal(searchText);
        if (found) {
            found.item.status = 'in-progress';
            saveGoals();
            return found.item;
        }
        return null;
    }

    /**
     * Add a new goal to a section
     */
    function addGoal(text, sectionName = null, status = 'pending') {
        let targetSection = null;

        if (sectionName) {
            // Find matching section
            const sectionLower = sectionName.toLowerCase();
            targetSection = goalsData.sections.find(s =>
                s.title.toLowerCase().includes(sectionLower)
            );
        }

        // Default to first section or create one
        if (!targetSection) {
            if (goalsData.sections.length > 0) {
                // Try to find "Immediate" or similar
                targetSection = goalsData.sections.find(s =>
                    s.title.toLowerCase().includes('immediate') ||
                    s.title.toLowerCase().includes('today') ||
                    s.title.toLowerCase().includes('priority')
                ) || goalsData.sections[0];
            } else {
                targetSection = {
                    id: generateId(),
                    title: 'Goals',
                    items: [],
                    collapsed: false
                };
                goalsData.sections.push(targetSection);
            }
        }

        const newItem = {
            id: generateId(),
            text: text,
            status: status
        };

        // Add at the beginning for visibility
        targetSection.items.unshift(newItem);
        saveGoals();

        return { section: targetSection, item: newItem };
    }

    /**
     * Remove a goal
     */
    function removeGoal(searchText) {
        const searchLower = searchText.toLowerCase();

        for (const section of goalsData.sections) {
            const index = section.items.findIndex(item =>
                item.text.toLowerCase().includes(searchLower)
            );

            if (index !== -1) {
                const removed = section.items.splice(index, 1)[0];
                saveGoals();
                return removed;
            }

            // Check subsections
            for (const item of section.items) {
                if (item.items) {
                    const subIndex = item.items.findIndex(subItem =>
                        subItem.text.toLowerCase().includes(searchLower)
                    );
                    if (subIndex !== -1) {
                        const removed = item.items.splice(subIndex, 1)[0];
                        saveGoals();
                        return removed;
                    }
                }
            }
        }
        return null;
    }

    /**
     * Update a goal's text
     */
    function updateGoal(searchText, newText) {
        const found = findGoal(searchText);
        if (found) {
            found.item.text = newText;
            saveGoals();
            return found.item;
        }
        return null;
    }

    /**
     * Toggle section collapsed state
     */
    function toggleSection(sectionId) {
        const section = goalsData.sections.find(s => s.id === sectionId);
        if (section) {
            section.collapsed = !section.collapsed;
            saveGoals();
        }
    }

    /**
     * Convert goals back to markdown
     */
    function toMarkdown() {
        let md = '';

        for (const section of goalsData.sections) {
            md += `## ${section.title}\n\n`;

            for (const item of section.items) {
                const statusMarker = getStatusMarker(item.status);

                if (item.isSubsection) {
                    md += `### ${item.text}\n`;
                    if (item.items) {
                        for (const subItem of item.items) {
                            const subMarker = getStatusMarker(subItem.status);
                            md += `- ${subMarker}${subItem.text}\n`;
                        }
                    }
                } else {
                    md += `- ${statusMarker}${item.text}\n`;
                }
            }
            md += '\n';
        }

        return md.trim();
    }

    /**
     * Get status marker for markdown
     */
    function getStatusMarker(status) {
        switch (status) {
            case 'completed': return '[x] ';
            case 'in-progress': return '[/] ';
            case 'blocked': return '[!] ';
            default: return '[ ] ';
        }
    }

    /**
     * Save goals to localStorage and Supabase
     */
    function saveGoals() {
        const markdown = toMarkdown();
        localStorage.setItem('conductor_goals_data', JSON.stringify(goalsData));
        localStorage.setItem('conductor_telos', markdown);

        // Also save to Supabase (async, fire and forget)
        if (window.SupabaseClient) {
            SupabaseClient.saveTelos(markdown).catch(console.error);
        }
    }

    /**
     * Load goals from storage
     */
    async function loadGoals() {
        // Try to load structured data first
        const storedData = localStorage.getItem('conductor_goals_data');
        if (storedData) {
            try {
                goalsData = JSON.parse(storedData);
                return goalsData;
            } catch (e) {
                console.error('Error parsing stored goals:', e);
            }
        }

        // Fall back to raw telos
        let telos = localStorage.getItem('conductor_telos');

        // Try Supabase if nothing local
        if (!telos && window.SupabaseClient) {
            telos = await SupabaseClient.loadTelos();
        }

        if (telos) {
            return parseGoals(telos);
        }

        return { sections: [], raw: '' };
    }

    /**
     * Get stats about goals
     */
    function getStats() {
        let total = 0;
        let completed = 0;
        let inProgress = 0;
        let blocked = 0;

        for (const section of goalsData.sections) {
            for (const item of section.items) {
                if (!item.isSubsection) {
                    total++;
                    if (item.status === 'completed') completed++;
                    else if (item.status === 'in-progress') inProgress++;
                    else if (item.status === 'blocked') blocked++;
                }
                if (item.items) {
                    for (const subItem of item.items) {
                        total++;
                        if (subItem.status === 'completed') completed++;
                        else if (subItem.status === 'in-progress') inProgress++;
                        else if (subItem.status === 'blocked') blocked++;
                    }
                }
            }
        }

        return { total, completed, inProgress, blocked, pending: total - completed - inProgress - blocked };
    }

    /**
     * Reorder a goal - move draggedId before targetId
     */
    function reorderGoal(draggedId, targetId) {
        let draggedItem = null;
        let draggedSection = null;
        let draggedIndex = -1;
        let targetSection = null;
        let targetIndex = -1;

        // Find dragged item
        for (const section of goalsData.sections) {
            const index = section.items.findIndex(i => i.id === draggedId);
            if (index !== -1) {
                draggedItem = section.items[index];
                draggedSection = section;
                draggedIndex = index;
                break;
            }
        }

        // Find target item
        for (const section of goalsData.sections) {
            const index = section.items.findIndex(i => i.id === targetId);
            if (index !== -1) {
                targetSection = section;
                targetIndex = index;
                break;
            }
        }

        if (!draggedItem || targetIndex === -1) return;

        // Remove from original position
        draggedSection.items.splice(draggedIndex, 1);

        // If same section and target is after dragged, adjust index
        if (draggedSection === targetSection && draggedIndex < targetIndex) {
            targetIndex--;
        }

        // Insert at new position
        targetSection.items.splice(targetIndex, 0, draggedItem);

        saveGoals();
    }

    // Public API
    return {
        parseGoals,
        getGoals,
        findGoal,
        completeGoal,
        startGoal,
        addGoal,
        removeGoal,
        updateGoal,
        toggleSection,
        toMarkdown,
        loadGoals,
        saveGoals,
        getStats,
        reorderGoal
    };
})();

// Export
if (typeof window !== 'undefined') {
    window.GoalsManager = GoalsManager;
}
