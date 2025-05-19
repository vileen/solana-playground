import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Chip } from 'primereact/chip';
import { InputTextarea } from 'primereact/inputtextarea';
import { confirmDialog } from 'primereact/confirmdialog';

interface ProfileDialogProps {
  visible: boolean;
  onHide: () => void;
  onSave: (profile: any) => void;
  onDelete?: (profileId: string) => void;
  profile?: any;
}

const ProfileDialog: React.FC<ProfileDialogProps> = ({
  visible,
  onHide,
  onSave,
  onDelete,
  profile
}) => {
  const [twitter, setTwitter] = useState('');
  const [discord, setDiscord] = useState('');
  const [comment, setComment] = useState('');
  const [newWallet, setNewWallet] = useState('');
  const [wallets, setWallets] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (profile) {
      setTwitter(profile.twitter || '');
      setDiscord(profile.discord || '');
      setComment(profile.comment || '');
      setWallets(profile.wallets?.map((w: any) => w.address || w) || []);
      setIsEditing(true);
    } else {
      setTwitter('');
      setDiscord('');
      setComment('');
      setWallets([]);
      setIsEditing(false);
    }
  }, [profile, visible]);

  const handleSave = () => {
    const updatedProfile = {
      id: profile?.id,
      twitter: twitter || null,
      discord: discord || null,
      comment: comment || null,
      wallets: wallets.map(address => ({ address }))
    };
    onSave(updatedProfile);
  };

  const handleDelete = () => {
    if (onDelete && profile?.id) {
      confirmDialog({
        message: 'Are you sure you want to delete this profile? This action cannot be undone.',
        header: 'Confirm Delete',
        icon: 'pi pi-exclamation-triangle',
        acceptClassName: 'p-button-danger',
        accept: () => {
          onDelete(profile.id);
          onHide();
        }
      });
    }
  };

  const addWallet = () => {
    if (newWallet && !wallets.includes(newWallet)) {
      setWallets([...wallets, newWallet]);
      setNewWallet('');
    }
  };

  const removeWallet = (wallet: string) => {
    setWallets(wallets.filter(w => w !== wallet));
  };

  const dialogFooter = (
    <div className="flex justify-content-between w-full">
      {isEditing && onDelete && (
        <Button 
          label="Delete" 
          icon="pi pi-trash" 
          className="p-button-danger" 
          onClick={handleDelete} 
        />
      )}
      <div className={isEditing && onDelete ? "ml-auto" : ""}>
        <Button label="Cancel" icon="pi pi-times" className="p-button-text" onClick={onHide} />
        <Button 
          label="Save" 
          icon="pi pi-check" 
          onClick={handleSave} 
          disabled={!twitter && !discord && !comment}
        />
      </div>
    </div>
  );

  return (
    <Dialog
      header={isEditing ? "Edit Social Profile" : "Add New Social Profile"}
      visible={visible}
      onHide={onHide}
      style={{ width: '500px' }}
      footer={dialogFooter}
      modal
    >
      <div className="p-fluid">
        <div className="field">
          <label htmlFor="twitter">Twitter</label>
          <InputText
            id="twitter"
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            placeholder="@username"
          />
        </div>
        
        <div className="field">
          <label htmlFor="discord">Discord</label>
          <InputText
            id="discord"
            value={discord}
            onChange={(e) => setDiscord(e.target.value)}
            placeholder="username#1234"
          />
        </div>
        
        <div className="field">
          <label htmlFor="comment">Comment/Note</label>
          <InputTextarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Add a note about this profile"
          />
        </div>
        
        <div className="field">
          <label>Wallet Addresses</label>
          <div className="flex gap-2 mb-2">
            <InputText
              value={newWallet}
              onChange={(e) => setNewWallet(e.target.value)}
              placeholder="Solana wallet address"
              className="flex-grow-1"
            />
            <Button 
              icon="pi pi-plus" 
              onClick={addWallet} 
              disabled={!newWallet}
            />
          </div>
          
          <div className="wallet-list mt-3">
            {wallets.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {wallets.map((wallet, index) => (
                  <Chip 
                    key={index} 
                    label={`${wallet.substring(0, 6)}...${wallet.substring(wallet.length - 4)}`}
                    removable 
                    onRemove={() => {
                      removeWallet(wallet);
                      return true;
                    }} 
                  />
                ))}
              </div>
            ) : (
              <div className="text-muted">No wallets added yet</div>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default ProfileDialog; 