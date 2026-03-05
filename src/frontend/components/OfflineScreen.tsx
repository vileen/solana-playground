import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import './OfflineScreen.css';

const FUNNY_GIFS = [
  'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
  'https://media.giphy.com/media/l41lI4bYmcsPJX9Go/giphy.gif',
];

const FUNNY_MESSAGES = [
  "Someone forgot to pay their internet bill 💸",
  "The hamster powering our servers took a coffee break ☕",
  "Even the WiFi is on vacation 🏖️",
  "Our backend is playing hide and seek... and winning 🙈",
  "The server is having an existential crisis 🤔",
  "Looks like our API went to grab a snack 🍕",
  "404: Motivation not found 🔍",
  "The internet tubes are clogged 🚰",
];

// Get API base URL
const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL ||
  (process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost'
    ? '/api'
    : 'http://localhost:3001/api');

interface OfflineScreenProps {
  onRetry: () => void;
}

export const OfflineScreen: React.FC<OfflineScreenProps> = ({ onRetry }) => {
  const [gifUrl] = useState(() => 
    FUNNY_GIFS[Math.floor(Math.random() * FUNNY_GIFS.length)]
  );
  const [message] = useState(() => 
    FUNNY_MESSAGES[Math.floor(Math.random() * FUNNY_MESSAGES.length)]
  );

  return (
    <div className="offline-screen">
      <div className="offline-container">
        <div className="gif-container">
          <img src={gifUrl} alt="Error" className="error-gif" />
        </div>
        <h1 className="offline-title">Oops! 🙃</h1>
        <p className="offline-message">{message}</p>
        <div className="offline-details">
          <p>Can't reach: <code>{API_BASE_URL}</code></p>
          <p className="offline-hint">Check your connection or try again later</p>
        </div>
        <Button 
          label="🔄 Try Again" 
          onClick={onRetry}
          className="p-button-lg"
        />
      </div>
    </div>
  );
};
