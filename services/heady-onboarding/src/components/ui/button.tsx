import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heady-primary disabled:pointer-events-none disabled:opacity-50",
          variant === "default" && "bg-heady-primary text-white hover:bg-heady-primary/90",
          variant === "outline" && "border border-heady-primary text-heady-primary hover:bg-heady-primary hover:text-white",
          variant === "ghost" && "hover:bg-heady-primary/10 text-heady-primary",
          "h-10 px-4 py-2",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
