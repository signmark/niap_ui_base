import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { FeatureFlags } from '@shared/feature-flags';

// Hook for accessing feature flags in React components
export const useFeatureFlags = () => {
  const { data: featureFlags, isLoading } = useQuery<FeatureFlags>({
    queryKey: ['/api/feature-flags'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    featureFlags: featureFlags || {},
    isLoading,
    
    // Helper functions for common checks
    isEnabled: (feature: keyof FeatureFlags): boolean => {
      return Boolean(featureFlags?.[feature]);
    },
    
    isDisabled: (feature: keyof FeatureFlags): boolean => {
      return !Boolean(featureFlags?.[feature]);
    },
  };
};

// Higher-order component for conditional feature rendering
interface FeatureGateProps {
  feature: keyof FeatureFlags;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loadingComponent?: React.ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ 
  feature, 
  children, 
  fallback = null,
  loadingComponent = null 
}) => {
  const { featureFlags, isLoading } = useFeatureFlags();
  
  if (isLoading) {
    return loadingComponent as React.ReactElement;
  }
  
  if (!featureFlags[feature]) {
    return fallback as React.ReactElement;
  }
  
  return children as React.ReactElement;
};

// Component for displaying "feature disabled" message
export const FeatureDisabledMessage: React.FC<{ 
  featureName: string; 
  message?: string;
}> = ({ featureName, message }) => {
  return (
    <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <div className="text-center">
        <div className="text-gray-400 mb-2">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-600 mb-1">
          {featureName}
        </h3>
        <p className="text-sm text-gray-500">
          {message || 'Эта функция временно недоступна'}
        </p>
      </div>
    </div>
  );
};