import React from "react";
import { cn } from "@/lib/utils";

const Badge = React.forwardRef(
    ({ className, variant = "default", ...props }, ref) => {
        const variants = {
            default: "border-transparent bg-slate-100 text-slate-900 shadow",
            outline: "text-slate-100 border-slate-700",
        };

        return (
            <span
                ref={ref}
                className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
                    variants[variant],
                    className
                )}
                {...props}
            />
        );
    }
);
Badge.displayName = "Badge";

export { Badge };
