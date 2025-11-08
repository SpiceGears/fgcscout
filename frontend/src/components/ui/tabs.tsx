"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = React.useState({
    width: 0,
    left: 0,
  })

  const updateIndicator = React.useCallback(() => {
    const active = listRef.current?.querySelector(
      '[data-state="active"]'
    ) as HTMLElement | null

    if (active) {
      const { offsetWidth, offsetLeft } = active
      setIndicatorStyle((prev) => {
        if (
          prev.width === offsetWidth &&
          prev.left === offsetLeft
        ) {
          return prev
        }
        return { width: offsetWidth, left: offsetLeft }
      })
    }
  }, [])

  React.useEffect(() => {
    updateIndicator()
    const observer = new ResizeObserver(updateIndicator)
    if (listRef.current) observer.observe(listRef.current)
    return () => observer.disconnect()
  }, [updateIndicator])

  return (
    <div className="relative w-fit">
      <TabsPrimitive.List
        ref={listRef}
        onClick={updateIndicator}
        data-slot="tabs-list"
        className={cn(
          "relative inline-flex items-center gap-4 px-1",
          className
        )}
        {...props}
      />
      <span
        className="absolute bottom-0 h-[2px] bg-indigo-500 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          width: `${indicatorStyle.width}px`,
          left: `${indicatorStyle.left}px`,
        }}
      />
    </div>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative text-sm font-medium px-3 py-2 text-gray-400 transition-colors hover:text-gray-100 data-[state=active]:text-white",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("mt-4 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }