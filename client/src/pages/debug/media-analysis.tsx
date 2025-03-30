import React from 'react';
import { MediaAnalysisDebugger } from '../../components/MediaAnalysisDebugger';

export default function MediaAnalysisDebugPage() {
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-8">Отладка анализа медиаконтента</h1>
      <MediaAnalysisDebugger />
    </div>
  );
}