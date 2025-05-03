'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Define variants for the alert notification
const alertNotificationVariants = cva(
  'relative w-full flex items-center gap-3 p-4 pr-8 rounded-lg border shadow-sm transition-all',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground border-border',
        success: 'bg-green-50 text-green-900 border-green-200 dark:bg-green-950 dark:text-green-50 dark:border-green-900',
        error: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950 dark:text-red-50 dark:border-red-900',
        warning: 'bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-50 dark:border-yellow-900',
        info: 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950 dark:text-blue-50 dark:border-blue-900',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

// Types for the alert notification
export interface AlertNotificationProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertNotificationVariants> {
  title?: string
  description?: string
  onClose?: () => void
}

// Context for the alert notification system
type AlertContextType = {
  alerts: AlertNotificationProps[]
  addAlert: (alert: Omit<AlertNotificationProps, 'onClose'>) => void
  removeAlert: (index: number) => void
}

const AlertContext = createContext<AlertContextType | undefined>(undefined)

// Provider component
export function AlertNotificationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [alerts, setAlerts] = useState<AlertNotificationProps[]>([])

  const addAlert = useCallback((alert: Omit<AlertNotificationProps, 'onClose'>) => {
    setAlerts((prev) => [...prev, { ...alert, onClose: () => {} }])
    
    // Auto-remove after 5 seconds (or customize duration)
    setTimeout(() => {
      setAlerts((prev) => prev.slice(1))
    }, 5000)
  }, [])

  const removeAlert = useCallback((index: number) => {
    setAlerts((prev) => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <AlertContext.Provider value={{ alerts, addAlert, removeAlert }}>
      {children}
      <AlertNotificationContainer />
    </AlertContext.Provider>
  )
}

// Hook to use the alert system
export function useAlertNotification() {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlertNotification must be used within an AlertNotificationProvider')
  }
  
  const { addAlert } = context
  
  return {
    success: (title: string, description?: string) => 
      addAlert({ variant: 'success', title, description }),
    error: (title: string, description?: string) => 
      addAlert({ variant: 'error', title, description }),
    warning: (title: string, description?: string) => 
      addAlert({ variant: 'warning', title, description }),
    info: (title: string, description?: string) => 
      addAlert({ variant: 'info', title, description }),
  }
}

// The actual alert notification component
export function AlertNotification({
  className,
  variant,
  title,
  description,
  onClose,
  ...props
}: AlertNotificationProps) {
  // Icon based on variant
  const Icon = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
    default: Info,
  }[variant || 'default']

  return (
    <div
      className={cn(alertNotificationVariants({ variant }), className)}
      {...props}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1">
        {title && <h5 className="font-medium">{title}</h5>}
        {description && <p className="text-sm opacity-90">{description}</p>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-2 top-2 rounded-full p-1 text-foreground/50 opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

// Container for all alerts
function AlertNotificationContainer() {
  const context = useContext(AlertContext)
  if (!context) return null
  
  const { alerts, removeAlert } = context
  
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
      {alerts.map((alert, index) => (
        <AlertNotification
          key={index}
          {...alert}
          onClose={() => removeAlert(index)}
          className="animate-in slide-in-from-right duration-300"
        />
      ))}
    </div>
  )
}
