// Service function signature overrides
declare module '../services/api.js' {
  export function saveSocialProfile(profileData: any): Promise<any>;
}
