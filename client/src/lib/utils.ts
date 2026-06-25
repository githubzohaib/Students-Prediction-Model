import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export const formatAuthors = (authors: string[]): string => {
  if (!authors || authors.length === 0) return 'Unknown';
  
  if (authors.length === 1) return authors[0];
  
  if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
  
  return `${authors[0]} et al.`;
};

/**
 * Converts NumberInt object to a regular number
 */
export const numberIntToNumber = (numInt: { $numberInt: string } | undefined): number => {
  if (!numInt || !numInt.$numberInt) return 0;
  return parseInt(numInt.$numberInt, 10);
};

/**
 * Format a book's publication date
 */
export const formatPublicationYear = (year: { $numberInt: string } | undefined): string => {
  if (!year || !year.$numberInt) return 'Unknown';
  return year.$numberInt;
};

/**
 * Extract MongoDB ID from object ID format
 */
export const extractMongoId = (id: { $oid: string } | undefined): string => {
  if (!id || !id.$oid) return '';
  return id.$oid;
};