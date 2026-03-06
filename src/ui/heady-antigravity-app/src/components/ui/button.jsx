import React from "react";
import { cn } from "@/lib/utils";

const Button = React.forwardRef(
    ({ className, variant = "default", size = "default", ...props }, ref) => {
        const variants = {
            default: "bg-amber-500 text-slate-950 shadow hover:bg-amber-600",
            secondary: "bg-slate-800 text-slate-100 shadow-sm hover:bg-slate-700",
            ghost: "hover:bg-slate-800 hover:text-slate-100",
            outline: "border border-slate-700 bg-transparent shadow-sm hover:bg-slate-800",
        };

        const sizes = {
            default: "h-9 px-4 py-2",
            sm: "h-8 rounded-md px-3 text-xs",
            lg: "h-10 rounded-md px-8",
            icon: "h-9 w-9",
        };

        return (
            <button
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
                    variants[variant],
                    sizes[size],
                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export { Button };
