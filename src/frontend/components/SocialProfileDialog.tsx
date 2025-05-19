import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { saveSocialProfile } from '../services/api.js';

interface SocialProfileDialogProps {
  visible: boolean;
  onHide: () => void;
  selectedHolder: any;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const SocialProfileDialog: React.FC<SocialProfileDialogProps> = ({
  visible,
  onHide,
  selectedHolder,
  onSuccess,
  onError
}) => {
  const [twitterHandle, setTwitterHandle] = useState('');
  const [discordHandle, setDiscordHandle] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedHolder) {
      // Initialize form with existing data if available
      setTwitterHandle(selectedHolder.twitter || '');
      setDiscordHandle(selectedHolder.discord || '');
      setComment(selectedHolder.comment || '');
    }
  }, [selectedHolder]);

  const handleSave = async () => {
    if (!selectedHolder?.address) {
      onError('No wallet address selected');
      return;
    }
    
    try {
      setLoading(true);
      const success = await saveSocialProfile(
        selectedHolder.address,
        twitterHandle,
        discordHandle,
        comment
      );
      
      if (success) {
        onSuccess('Social profile saved successfully');
        onHide();
      } else {
        onError('Failed to save social profile');
      }
    } catch (error: any) {
      onError(`Error saving profile: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const dialogFooter = (
    <div>
      <Button 
        label="Cancel" 
        icon="pi pi-times" 
        onClick={onHide} 
        className="p-button-text" 
      />
      <Button 
        label="Save" 
        icon="pi pi-check" 
        onClick={handleSave} 
        loading={loading}
        autoFocus 
      />
    </div>
  );

  return (
    <Dialog
      header="Edit Social Profile"
      visible={visible}
      style={{ width: '450px' }}
      footer={dialogFooter}
      onHide={onHide}
      modal
      className="social-profile-dialog"
    >
      {selectedHolder && (
        <div className="p-grid p-fluid">
          <div className="p-field p-col-12">
            <label htmlFor="wallet">Wallet</label>
            <InputText id="wallet" value={selectedHolder.address} disabled />
          </div>
          
          <div className="p-field p-col-12">
            <label htmlFor="twitter">Twitter Handle</label>
            <InputText 
              id="twitter" 
              value={twitterHandle} 
              onChange={(e) => setTwitterHandle(e.target.value)} 
              placeholder="@username"
            />
          </div>
          
          <div className="p-field p-col-12">
            <label htmlFor="discord">Discord Handle</label>
            <InputText 
              id="discord" 
              value={discordHandle} 
              onChange={(e) => setDiscordHandle(e.target.value)} 
              placeholder="username#1234"
            />
          </div>
          
          <div className="p-field p-col-12">
            <label htmlFor="comment">Comment/Notes</label>
            <InputText 
              id="comment" 
              value={comment} 
              onChange={(e) => setComment(e.target.value)} 
              placeholder="Additional notes about this holder"
            />
          </div>
        </div>
      )}
    </Dialog>
  );
};

export default SocialProfileDialog; 