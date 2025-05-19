import React, { useEffect, useState } from 'react';

import { AutoComplete } from 'primereact/autocomplete';
import { Button } from 'primereact/button';
import { Chip } from 'primereact/chip';
import { confirmDialog } from 'primereact/confirmdialog';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';

import { fetchSocialProfiles } from '../services/api.js';

interface SocialProfileSuggestion {
  id: string;
  displayName: string;
  twitter: string | null;
  discord: string | null;
  comment: string | null;
  wallets: Array<{ address: string }>;
}

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
  profile,
}) => {
  const [twitter, setTwitter] = useState('');
  const [discord, setDiscord] = useState('');
  const [comment, setComment] = useState('');
  const [newWallet, setNewWallet] = useState('');
  const [wallets, setWallets] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // For profile search
  const [searchTerm, setSearchTerm] = useState<SocialProfileSuggestion | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<SocialProfileSuggestion[]>([]);
  const [allProfiles, setAllProfiles] = useState<SocialProfileSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadAllProfiles();
    }
  }, [visible]);

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

  const loadAllProfiles = async () => {
    try {
      setLoading(true);
      const profiles = await fetchSocialProfiles();

      // Group profiles by ID
      const groupedProfiles = new Map<string, SocialProfileSuggestion>();

      profiles.forEach((profile: any) => {
        // Skip profiles without ID
        if (!profile.id) return;

        const profileId = profile.id;
        const displayName = profile.comment || profile.twitter || profile.discord || 'Unknown';

        if (groupedProfiles.has(profileId)) {
          // Add wallet to existing profile
          const existingProfile = groupedProfiles.get(profileId)!;
          if (profile.address) {
            existingProfile.wallets.push({ address: profile.address });
          }
        } else {
          // Create new profile suggestion
          groupedProfiles.set(profileId, {
            id: profileId,
            displayName,
            twitter: profile.twitter,
            discord: profile.discord,
            comment: profile.comment,
            wallets: profile.address ? [{ address: profile.address }] : [],
          });
        }
      });

      // Convert map to array
      const profileSuggestions = Array.from(groupedProfiles.values());
      setAllProfiles(profileSuggestions);
    } catch (error) {
      console.error('Error loading profiles for search:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchProfiles = (event: { query: string }) => {
    const query = event.query.toLowerCase();

    // If query is empty, show all profiles with meaningful data
    if (!query) {
      setSuggestions(
        allProfiles.filter(
          profile =>
            (profile.displayName && profile.displayName.trim() !== '') ||
            (profile.twitter && profile.twitter.trim() !== '') ||
            (profile.discord && profile.discord.trim() !== '') ||
            (profile.comment && profile.comment.trim() !== '')
        )
      );
      return;
    }

    // Filter profiles based on search term
    const filteredProfiles = allProfiles.filter(
      profile =>
        (profile.displayName && profile.displayName.toLowerCase().includes(query)) ||
        (profile.twitter && profile.twitter.toLowerCase().includes(query)) ||
        (profile.discord && profile.discord.toLowerCase().includes(query)) ||
        (profile.comment && profile.comment.toLowerCase().includes(query)) ||
        profile.wallets.some(w => w.address.toLowerCase().includes(query))
    );

    console.log(`Found ${filteredProfiles.length} profile suggestions for "${query}"`);
    setSuggestions(filteredProfiles);
  };

  const selectProfile = (profile: SocialProfileSuggestion) => {
    // Fill the form with the selected profile's data
    setTwitter(profile.twitter || '');
    setDiscord(profile.discord || '');
    setComment(profile.comment || '');
    setWallets(profile.wallets.map(w => w.address));

    // Set editing mode and update the profile ID
    setIsEditing(true);

    // Clear search term after selection
    setSearchTerm(undefined);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const updatedProfile = {
        id: profile?.id,
        twitter: twitter || null,
        discord: discord || null,
        comment: comment || null,
        wallets: wallets.map(address => ({ address })),
      };
      return onSave(updatedProfile);
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setLoading(false);
    }
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
        },
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

  const onDialogHide = (e?: React.SyntheticEvent) => {
    // If we're in the middle of loading, prevent dialog from being dismissed
    if (loading) {
      if (e) e.preventDefault();
      return;
    }

    // Reset form state
    if (!profile) {
      setTwitter('');
      setDiscord('');
      setComment('');
      setWallets([]);
      setSearchTerm(undefined);
    }

    // Call the parent's onHide
    onHide();
  };

  const dialogFooter = (
    <div className="flex justify-content-between w-full">
      {isEditing && onDelete && (
        <Button
          label="Delete"
          icon="pi pi-trash"
          className="p-button-danger"
          onClick={handleDelete}
          disabled={loading}
        />
      )}
      <div className={isEditing && onDelete ? 'ml-auto' : ''}>
        <Button
          label="Cancel"
          icon="pi pi-times"
          className="p-button-text"
          onClick={e => {
            // Stop event propagation to prevent parent dialogs from closing
            e.stopPropagation();
            onDialogHide();
          }}
          disabled={loading}
        />
        <Button
          label="Save"
          icon="pi pi-check"
          onClick={handleSave}
          disabled={(!twitter && !discord && !comment) || loading}
          loading={loading}
        />
      </div>
    </div>
  );

  // Custom template for profile suggestions
  const itemTemplate = (item: SocialProfileSuggestion) => {
    return (
      <div className="profile-suggestion">
        <div className="font-bold">{item.displayName}</div>
        <div className="text-sm">
          {item.twitter && <span className="mr-2">🐦 {item.twitter}</span>}
          {item.discord && <span className="mr-2">💬 {item.discord}</span>}
          {item.wallets.length > 0 && <span>👛 {item.wallets.length} wallet(s)</span>}
        </div>
      </div>
    );
  };

  return (
    <Dialog
      header={isEditing ? 'Edit Social Profile' : 'Add New Social Profile'}
      visible={visible}
      onHide={onDialogHide}
      style={{ width: '500px' }}
      footer={dialogFooter}
      modal
      closable={!loading}
    >
      <div className="p-fluid">
        {!isEditing && (
          <div className="field mb-4">
            <label htmlFor="profile-search">Search Existing Profiles</label>
            <div className="p-inputgroup">
              <AutoComplete
                id="profile-search"
                value={searchTerm}
                suggestions={suggestions}
                completeMethod={searchProfiles}
                onChange={e => setSearchTerm(e.value)}
                onSelect={e => selectProfile(e.value)}
                field="displayName"
                dropdown
                forceSelection={false}
                placeholder="Search by name, twitter, discord, or wallet"
                itemTemplate={itemTemplate}
                className="w-full"
                aria-label="Search Profiles"
              />
              {loading && (
                <span className="p-inputgroup-addon">
                  <i className="pi pi-spin pi-spinner"></i>
                </span>
              )}
            </div>
            <small className="text-muted">Search for existing profiles to avoid duplicates</small>
          </div>
        )}

        <div className="field">
          <label htmlFor="twitter">Twitter</label>
          <InputText
            id="twitter"
            value={twitter}
            onChange={e => setTwitter(e.target.value)}
            placeholder="@username"
          />
        </div>

        <div className="field">
          <label htmlFor="discord">Discord</label>
          <InputText
            id="discord"
            value={discord}
            onChange={e => setDiscord(e.target.value)}
            placeholder="username#1234"
          />
        </div>

        <div className="field">
          <label htmlFor="comment">Comment/Note</label>
          <InputTextarea
            id="comment"
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            placeholder="Add a note about this profile"
          />
        </div>

        <div className="field">
          <label>Wallet Addresses</label>
          <div className="flex gap-2 mb-2">
            <InputText
              value={newWallet}
              onChange={e => setNewWallet(e.target.value)}
              placeholder="Solana wallet address"
              className="flex-grow-1"
            />
            <Button icon="pi pi-plus" onClick={addWallet} disabled={!newWallet} />
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
