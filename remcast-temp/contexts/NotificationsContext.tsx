import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getUnreadCount } from '../services/notificationsService';
import { useAuth } from './AuthContext';

interface NotificationsContextType {
    unreadCount: number;
    refreshUnreadCount: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType>({
    unreadCount: 0,
    refreshUnreadCount: async () => { },
});

export function NotificationsProvider({ children }: { children: ReactNode }) {
    const [unreadCount, setUnreadCount] = useState(0);
    const { user } = useAuth();

    const refreshUnreadCount = useCallback(async () => {
        if (!user) {
            setUnreadCount(0);
            return;
        }
        const count = await getUnreadCount();
        setUnreadCount(count);
    }, [user]);

    // Initial load and periodic refresh
    useEffect(() => {
        if (user) {
            refreshUnreadCount();

            // Poll every 30 seconds for new notifications
            const interval = setInterval(refreshUnreadCount, 30000);
            return () => clearInterval(interval);
        } else {
            setUnreadCount(0);
        }
    }, [user, refreshUnreadCount]);

    return (
        <NotificationsContext.Provider value={{ unreadCount, refreshUnreadCount }}>
            {children}
        </NotificationsContext.Provider>
    );
}

export function useNotifications() {
    return useContext(NotificationsContext);
}
