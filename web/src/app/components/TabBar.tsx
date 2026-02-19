"use client";

import { useEffect, useRef, useState } from "react";

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs: { id: string; label: string }[];
}

export default function TabBar({ activeTab, onTabChange, tabs }: TabBarProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const activeIndex = tabs.findIndex((t) => t.id === activeTab);
    const el = tabRefs.current[activeIndex];
    if (el) {
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [activeTab, tabs]);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        borderBottom: "1px solid #e8dfd6",
        padding: "0 16px",
        background: "#fdfcfb",
      }}
    >
      {/* Sliding indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: indicator.left,
          width: indicator.width,
          height: "2px",
          background: "#d9a88f",
          borderRadius: "2px 2px 0 0",
          transition: "left 0.22s cubic-bezier(0.4,0,0.2,1), width 0.22s cubic-bezier(0.4,0,0.2,1)",
        }}
      />

      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          ref={(el) => { tabRefs.current[i] = el; }}
          onClick={() => onTabChange(tab.id)}
          style={{
            padding: "12px 16px",
            fontSize: "13px",
            fontWeight: 500,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: activeTab === tab.id ? "#3a3229" : "#8b7e70",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => {
            if (activeTab !== tab.id) (e.target as HTMLElement).style.color = "#3a3229";
          }}
          onMouseLeave={(e) => {
            if (activeTab !== tab.id) (e.target as HTMLElement).style.color = "#8b7e70";
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
