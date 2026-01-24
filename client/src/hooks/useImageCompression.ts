import imageCompression from 'browser-image-compression';
import { useState } from 'react';

interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  quality?: number;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxSizeMB: 1, // Maximum file size in MB
  maxWidthOrHeight: 1920, // Maximum width or height
  useWebWorker: true, // Use web worker for better performance
  quality: 0.8, // Quality (0-1)
};

/**
 * Hook for compressing images before upload
 * Reduces file size and improves upload speed on mobile
 */
export function useImageCompression() {
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);

  /**
   * Compress a single image file
   */
  const compressImage = async (
    file: File,
    options: CompressionOptions = {}
  ): Promise<File> => {
    setIsCompressing(true);
    setCompressionProgress(0);

    try {
      const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

      const compressedFile = await imageCompression(file, {
        ...mergedOptions,
        onProgress: (progress: number) => {
          setCompressionProgress(progress);
        },
      });

      setIsCompressing(false);
      setCompressionProgress(100);

      return compressedFile;
    } catch (error) {
      setIsCompressing(false);
      setCompressionProgress(0);
      console.error('Image compression failed:', error);
      // Return original file if compression fails
      return file;
    }
  };

  /**
   * Compress multiple image files
   */
  const compressImages = async (
    files: File[],
    options: CompressionOptions = {}
  ): Promise<File[]> => {
    setIsCompressing(true);
    setCompressionProgress(0);

    try {
      const compressedFiles = await Promise.all(
        files.map(async (file, index) => {
          const compressed = await compressImage(file, options);
          setCompressionProgress(((index + 1) / files.length) * 100);
          return compressed;
        })
      );

      setIsCompressing(false);
      return compressedFiles;
    } catch (error) {
      setIsCompressing(false);
      setCompressionProgress(0);
      console.error('Batch image compression failed:', error);
      return files;
    }
  };

  /**
   * Check if a file is an image
   */
  const isImageFile = (file: File): boolean => {
    return file.type.startsWith('image/');
  };

  /**
   * Get compression ratio as percentage
   */
  const getCompressionRatio = (originalSize: number, compressedSize: number): number => {
    return Math.round(((originalSize - compressedSize) / originalSize) * 100);
  };

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return {
    compressImage,
    compressImages,
    isCompressing,
    compressionProgress,
    isImageFile,
    getCompressionRatio,
    formatFileSize,
  };
}
