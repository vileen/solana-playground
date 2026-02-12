import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavigationOptions {
  replace?: boolean;
  preserveSearch?: boolean;
}

// Tab routes mapping
export const TAB_ROUTES = {
  NFT_HOLDERS: '/nft-holders',
  TOKEN_HOLDERS: '/token-holders',
  EVENTS: '/events',
  TIMELINE: '/timeline',
  SOCIAL_PROFILES: '/social-profiles',
  STAKING: '/staking',
};

// Map tab indices to routes
export const TAB_INDEX_TO_ROUTE = [
  TAB_ROUTES.NFT_HOLDERS,
  TAB_ROUTES.TOKEN_HOLDERS,
  TAB_ROUTES.EVENTS,
  TAB_ROUTES.TIMELINE,
  TAB_ROUTES.STAKING,
  TAB_ROUTES.SOCIAL_PROFILES,
];

// Map routes to tab indices
export const ROUTE_TO_TAB_INDEX: Record<string, number> = {
  [TAB_ROUTES.NFT_HOLDERS]: 0,
  [TAB_ROUTES.TOKEN_HOLDERS]: 1,
  [TAB_ROUTES.EVENTS]: 2,
  [TAB_ROUTES.TIMELINE]: 3,
  [TAB_ROUTES.STAKING]: 4,
  [TAB_ROUTES.SOCIAL_PROFILES]: 5,
};

/**
 * Custom hook for handling app-specific navigation.
 * Returns a memoized object so it's safe to use in dependency arrays.
 */
export function useAppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Navigate to a path with an optional search parameter
   */
  const navigateTo = useCallback(
    (path: string, searchTerm?: string, options: NavigationOptions = {}) => {
      // If preserveSearch is true, maintain the current search params
      let queryParams = new URLSearchParams();

      if (options.preserveSearch) {
        queryParams = new URLSearchParams(location.search);
      }

      if (searchTerm !== undefined) {
        if (searchTerm) {
          queryParams.set('search', searchTerm);
        } else {
          queryParams.delete('search');
        }
      }

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      navigate(`${path}${queryString}`, { replace: options.replace });
    },
    [navigate, location.search]
  );

  /**
   * Navigate to a tab by index, preserving search parameters if requested
   */
  const navigateToTab = useCallback(
    (tabIndex: number, options: NavigationOptions = {}) => {
      const path = TAB_INDEX_TO_ROUTE[tabIndex];
      if (path) {
        navigateTo(path, undefined, { ...options, preserveSearch: options.preserveSearch ?? true });
      }
    },
    [navigateTo]
  );

  /**
   * Navigate to NFT holders page with optional search parameter
   */
  const navigateToNftHolders = useCallback(
    (searchTerm?: string, options: NavigationOptions = {}) => {
      navigateTo(TAB_ROUTES.NFT_HOLDERS, searchTerm, options);
    },
    [navigateTo]
  );

  /**
   * Navigate to token holders page with optional search parameter
   */
  const navigateToTokenHolders = useCallback(
    (searchTerm?: string, options: NavigationOptions = {}) => {
      navigateTo(TAB_ROUTES.TOKEN_HOLDERS, searchTerm, options);
    },
    [navigateTo]
  );

  /**
   * Navigate to social profiles page with optional search parameter
   */
  const navigateToSocialProfiles = useCallback(
    (searchTerm?: string, options: NavigationOptions = {}) => {
      navigateTo(TAB_ROUTES.SOCIAL_PROFILES, searchTerm, options);
    },
    [navigateTo]
  );

  /**
   * Update search parameter while staying on the current page
   */
  const updateSearchParam = useCallback(
    (searchTerm: string, options: NavigationOptions = {}) => {
      const params = new URLSearchParams(location.search);

      if (searchTerm) {
        params.set('search', searchTerm);
      } else {
        params.delete('search');
      }

      navigate(`${location.pathname}?${params.toString()}`, { replace: options.replace ?? true });
    },
    [navigate, location.search, location.pathname]
  );

  /**
   * Get the current search parameter from the URL
   */
  const getSearchParam = useCallback((): string => {
    const params = new URLSearchParams(location.search);
    return params.get('search') || '';
  }, [location.search]);

  /**
   * Get the current tab index based on the URL path
   */
  const getCurrentTabIndex = useCallback((): number => {
    const path = location.pathname;

    // Check if the path starts with any of our tab routes
    for (const [route, index] of Object.entries(ROUTE_TO_TAB_INDEX)) {
      if (path === route || path.startsWith(route + '/')) {
        return index;
      }
    }

    // Default to the first tab if no match
    return 0;
  }, [location.pathname]);

  // Memoize the entire return object so consumers get a stable reference
  return useMemo(
    () => ({
      navigateTo,
      navigateToTab,
      navigateToNftHolders,
      navigateToTokenHolders,
      navigateToSocialProfiles,
      updateSearchParam,
      getSearchParam,
      getCurrentTabIndex,
      currentPath: location.pathname,
    }),
    [
      navigateTo,
      navigateToTab,
      navigateToNftHolders,
      navigateToTokenHolders,
      navigateToSocialProfiles,
      updateSearchParam,
      getSearchParam,
      getCurrentTabIndex,
      location.pathname,
    ]
  );
}
