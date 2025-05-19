import React, { createContext, ReactNode, useReducer } from 'react';

// Define the state interface
interface AppState {
  isLoading: boolean;
  nftHolders: any[];
  tokenHolders: any[];
  socialProfiles: any[];
  error: string | null;
  lastUpdated: {
    nft: Date | null;
    token: Date | null;
  };
}

// Define action types
type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_NFT_HOLDERS'; payload: any[] }
  | { type: 'SET_TOKEN_HOLDERS'; payload: any[] }
  | { type: 'SET_SOCIAL_PROFILES'; payload: any[] }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_LAST_UPDATED_NFT'; payload: Date }
  | { type: 'SET_LAST_UPDATED_TOKEN'; payload: Date };

// Initial state
const initialState: AppState = {
  isLoading: false,
  nftHolders: [],
  tokenHolders: [],
  socialProfiles: [],
  error: null,
  lastUpdated: {
    nft: null,
    token: null,
  },
};

// Create context
export const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}>({
  state: initialState,
  dispatch: () => null,
});

// Reducer function
const reducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_NFT_HOLDERS':
      return { ...state, nftHolders: action.payload };
    case 'SET_TOKEN_HOLDERS':
      return { ...state, tokenHolders: action.payload };
    case 'SET_SOCIAL_PROFILES':
      return { ...state, socialProfiles: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_LAST_UPDATED_NFT':
      return {
        ...state,
        lastUpdated: { ...state.lastUpdated, nft: action.payload },
      };
    case 'SET_LAST_UPDATED_TOKEN':
      return {
        ...state,
        lastUpdated: { ...state.lastUpdated, token: action.payload },
      };
    default:
      return state;
  }
};

// Create provider component
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}; 