// Load theme CSS
export const loadThemeCSS = (dark: boolean): void => {
  const themeLink = document.getElementById('app-theme') as HTMLLinkElement;
  
  if (themeLink) {
    themeLink.href = `https://cdn.jsdelivr.net/npm/primereact@9/resources/themes/lara-${dark ? 'dark' : 'light'}-indigo/theme.css`;
  } else {
    const link = document.createElement('link');
    link.id = 'app-theme';
    link.rel = 'stylesheet';
    link.href = `https://cdn.jsdelivr.net/npm/primereact@9/resources/themes/lara-${dark ? 'dark' : 'light'}-indigo/theme.css`;
    document.head.appendChild(link);
  }

  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.body.style.backgroundColor = dark ? '#121212' : '#f5f5f5';
  document.body.style.color = dark ? '#e0e0e0' : '#212121';
};

// Toggle theme
export const toggleTheme = (isDarkMode: boolean): boolean => {
  const newThemeValue = !isDarkMode;
  localStorage.setItem('theme-preference', newThemeValue ? 'dark' : 'light');
  loadThemeCSS(newThemeValue);
  return newThemeValue;
};

// Get saved theme preference
export const getSavedTheme = (): boolean => {
  const savedTheme = localStorage.getItem('theme-preference');
  return savedTheme === 'light' ? false : true; // Default to dark if not set
}; 