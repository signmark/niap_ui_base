import React, { useState, useRef } from 'react';
import { uploadImage, uploadMultipleImages } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// Получаем токен напрямую из localStorage, так как компонент демонстрационный
const getToken = () => localStorage.getItem('auth_token');

type UploadedFile = {
  url: string;
  fileId: string;
  originalName?: string;
  size?: number;
  mimetype?: string;
};

export function FileUploadDemo() {
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [multipleFiles, setMultipleFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const multipleFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const token = getToken();

  const handleSingleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSingleFile(e.target.files[0]);
    }
  };

  const handleMultipleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setMultipleFiles(Array.from(e.target.files));
    }
  };

  const handleSingleFileUpload = async () => {
    if (!singleFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a file to upload',
        variant: 'destructive',
      });
      return;
    }

    if (!token) {
      toast({
        title: 'Authentication required',
        description: 'You need to be logged in to upload files',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const result = await uploadImage(singleFile);
      toast({
        title: 'File uploaded successfully',
        description: `File "${singleFile.name}" has been uploaded`,
      });
      setUploadedFiles(prev => [...prev, result]);
      setSingleFile(null);
      if (singleFileInputRef.current) {
        singleFileInputRef.current.value = '';
      }
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleMultipleFileUpload = async () => {
    if (multipleFiles.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select files to upload',
        variant: 'destructive',
      });
      return;
    }

    if (!token) {
      toast({
        title: 'Authentication required',
        description: 'You need to be logged in to upload files',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const results = await uploadMultipleImages(multipleFiles);
      toast({
        title: 'Files uploaded successfully',
        description: `${results.length} files have been uploaded`,
      });
      
      // Extract URLs from the response and add to uploaded files
      const newFiles = results.map((file: any) => ({
        url: file.fileUrl,
        fileId: file.fileInfo.id,
        originalName: file.originalName,
        size: file.size,
        mimetype: file.mimetype
      }));
      
      setUploadedFiles(prev => [...prev, ...newFiles]);
      setMultipleFiles([]);
      if (multipleFileInputRef.current) {
        multipleFileInputRef.current.value = '';
      }
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload files',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>File Upload Demo</CardTitle>
          <CardDescription>
            Test uploading files with both Directus (when available) and local storage fallback
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Single File Upload</h3>
            <div className="flex gap-2">
              <Input
                ref={singleFileInputRef}
                type="file"
                onChange={handleSingleFileChange}
                disabled={isUploading}
              />
              <Button 
                onClick={handleSingleFileUpload} 
                disabled={!singleFile || isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-medium">Multiple Files Upload</h3>
            <div className="flex gap-2">
              <Input
                ref={multipleFileInputRef}
                type="file"
                multiple
                onChange={handleMultipleFileChange}
                disabled={isUploading}
              />
              <Button 
                onClick={handleMultipleFileUpload} 
                disabled={multipleFiles.length === 0 || isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload All
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Files</CardTitle>
            <CardDescription>
              Files that have been successfully uploaded ({uploadedFiles.length})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="border rounded-lg overflow-hidden">
                  {file.mimetype?.startsWith('image/') ? (
                    <div className="aspect-video flex items-center justify-center bg-gray-100">
                      <img 
                        src={file.url} 
                        alt={file.originalName || `Uploaded file ${index + 1}`} 
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video flex items-center justify-center bg-gray-100">
                      <div className="text-center p-4">
                        <p className="text-lg font-medium">{file.originalName || `File ${index + 1}`}</p>
                        <p className="text-sm text-gray-500">{file.mimetype}</p>
                      </div>
                    </div>
                  )}
                  <div className="p-3">
                    <h4 className="font-medium truncate" title={file.originalName}>
                      {file.originalName || `File ${index + 1}`}
                    </h4>
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                      {file.size && (
                        <span>{Math.round(file.size / 1024)} KB</span>
                      )}
                      <a 
                        href={file.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700"
                      >
                        View
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}