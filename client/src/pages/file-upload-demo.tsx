import React from 'react';
import { FileUploadDemo } from '@/components/FileUploadDemo';
import { AuthGuard } from '@/components/AuthGuard';

export default function FileUploadDemoPage() {
  return (
    <AuthGuard>
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">File Upload Demo</h1>
        <p className="mb-6">
          This page demonstrates file upload functionality with fallback to local storage when Directus is unavailable.
        </p>
        <FileUploadDemo />
      </div>
    </AuthGuard>
  );
}