// src/utils/validation.ts
/**
 * Validates if the email belongs to the allowed university domain
 * @param email - The email to validate
 * @returns boolean - Whether the email domain is allowed
 */
export function isUniversityEmail(email: string): boolean {
    // Replace 'university.edu' with your actual university domain
    const allowedDomains = ['neduet.edu.pk','cloud.neduet.edu.pk'];
    
    try {
      // Extract domain from email
      const domain = email.split('@')[1].toLowerCase();
      return allowedDomains.includes(domain);
    } catch (error) {
      return false;
    }
  }