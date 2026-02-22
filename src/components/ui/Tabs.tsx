import React from 'react';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className = '' }) => {
  console.log('🔍 [Tabs] Props:', { tabs, activeTab, onChange: typeof onChange });
  
  return (
    <div className={`border-b border-gray-200 mb-6 ${className}`}>
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              console.log('🔍 [Tabs] Click en tab:', tab.id, 'onChange:', typeof onChange);
              if (typeof onChange === 'function') {
                onChange(tab.id);
              } else {
                console.error('💥 [Tabs] onChange no es una función:', onChange);
              }
            }}
            className={`
              py-2 px-1 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};
