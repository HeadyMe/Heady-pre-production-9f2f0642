import React, { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

const TooltipContext = createContext({});

const TooltipProvider = ({ children }) => {
    return <>{children}</>;
};

const Tooltip = ({ children }) => {
    const [open, setOpen] = useState(false);
    return (
        <TooltipContext.Provider value={{ open, setOpen }}>
            <div className="relative inline-flex">{children}</div>
        </TooltipContext.Provider>
    );
};

const TooltipTrigger = React.forwardRef(({ children, ...props }, ref) => {
    const { setOpen } = useContext(TooltipContext);
    return (
        <div
            ref={ref}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            {...props}
        >
            {children}
        </div>
    );
});
TooltipTrigger.displayName = "TooltipTrigger";

const TooltipContent = React.forwardRef(({ className, children, ...props }, ref) => {
    const { open } = useContext(TooltipContext);
    if (!open) return null;
    return (
        <div
            ref={ref}
            className={cn(
                "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 overflow-hidden rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-100 shadow-md animate-in fade-in-0 zoom-in-95",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
});
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
