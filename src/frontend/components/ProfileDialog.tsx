import React, { useEffect, useState } from 'react';

import { AutoComplete } from 'primereact/autocomplete';
import { Button } from 'primereact/button';
import { Chip } from 'primereact/chip';
import { confirmDialog } from 'primereact/confirmdialog';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';

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
  selectedWalletAddress?: string;
}

const ProfileDialog: React.FC<ProfileDialogProps> = ({
  visible,
  onHide,
  onSave,
  onDelete,
  profile,
  selectedWalletAddress: propSelectedWallet,
}) => {
  const [twitter, setTwitter] = useState('');
  const [discord, setDiscord] = useState('');
  const [comment, setComment] = useState('');
  const [newWallet, setNewWallet] = useState('');
  const [wallets, setWallets] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedWalletAddress, setSelectedWalletAddress] = useState<string | undefined>(undefined);

  // For profile search
  const [searchTerm, setSearchTerm] = useState<SocialProfileSuggestion | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<SocialProfileSuggestion[]>([]);
  const [allProfiles, setAllProfiles] = useState<SocialProfileSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  // For Twitter, Discord, Comment autocomplete
  const [twitterSuggestions, setTwitterSuggestions] = useState<string[]>([]);
  const [discordSuggestions, setDiscordSuggestions] = useState<string[]>([]);
  const [commentSuggestions, setCommentSuggestions] = useState<string[]>([]);

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
      
      // Check for selected wallet from direct prop or from profile object
      if (propSelectedWallet) {
        setSelectedWalletAddress(propSelectedWallet);
      } else if (profile.selectedWalletAddress) {
        setSelectedWalletAddress(profile.selectedWalletAddress);
      } else if (profile.wallets?.length === 1) {
        // If there's only one wallet, select it
        setSelectedWalletAddress(profile.wallets[0].address || profile.wallets[0]);
      } else {
        setSelectedWalletAddress(undefined);
      }
    } else {
      setTwitter('');
      setDiscord('');
      setComment('');
      setWallets([]);
      setIsEditing(false);
      setSelectedWalletAddress(undefined);
    }
  }, [profile, visible, propSelectedWallet]);

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

  // Search for Twitter handles
  const searchTwitterHandles = (event: { query: string }) => {
    const query = event.query.toLowerCase();
    
    if (!query) {
      setTwitterSuggestions([]);
      return;
    }
    
    const filteredHandles = allProfiles
      .filter(profile => profile.twitter && profile.twitter.toLowerCase().includes(query))
      .map(profile => profile.twitter || '')
      .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
    
    setTwitterSuggestions(filteredHandles);
  };

  // Search for Discord handles
  const searchDiscordHandles = (event: { query: string }) => {
    const query = event.query.toLowerCase();
    
    if (!query) {
      setDiscordSuggestions([]);
      return;
    }
    
    const filteredHandles = allProfiles
      .filter(profile => profile.discord && profile.discord.toLowerCase().includes(query))
      .map(profile => profile.discord || '')
      .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
    
    setDiscordSuggestions(filteredHandles);
  };

  // Search for Comments
  const searchComments = (event: { query: string }) => {
    const query = event.query.toLowerCase();
    
    if (!query) {
      setCommentSuggestions([]);
      return;
    }
    
    const filteredComments = allProfiles
      .filter(profile => profile.comment && profile.comment.toLowerCase().includes(query))
      .map(profile => profile.comment || '')
      .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
    
    setCommentSuggestions(filteredComments);
  };

  // When a user selects a Twitter handle, find the associated profile
  const onTwitterSelect = (value: string) => {
    const matchingProfile = allProfiles.find(profile => profile.twitter === value);
    if (matchingProfile) {
      setDiscord(matchingProfile.discord || '');
      setComment(matchingProfile.comment || '');
      
      // Add wallet addresses if they don't already exist
      const existingWallets = new Set(wallets);
      const newWallets = matchingProfile.wallets
        .map(w => w.address)
        .filter(address => !existingWallets.has(address));
      
      if (newWallets.length > 0) {
        setWallets([...wallets, ...newWallets]);
      }
    }
  };

  // When a user selects a Discord handle, find the associated profile
  const onDiscordSelect = (value: string) => {
    const matchingProfile = allProfiles.find(profile => profile.discord === value);
    if (matchingProfile) {
      setTwitter(matchingProfile.twitter || '');
      setComment(matchingProfile.comment || '');
      
      // Add wallet addresses if they don't already exist
      const existingWallets = new Set(wallets);
      const newWallets = matchingProfile.wallets
        .map(w => w.address)
        .filter(address => !existingWallets.has(address));
      
      if (newWallets.length > 0) {
        setWallets([...wallets, ...newWallets]);
      }
    }
  };

  // When a user selects a Comment, find the associated profile
  const onCommentSelect = (value: string) => {
    const matchingProfile = allProfiles.find(profile => profile.comment === value);
    if (matchingProfile) {
      setTwitter(matchingProfile.twitter || '');
      setDiscord(matchingProfile.discord || '');
      
      // Add wallet addresses if they don't already exist
      const existingWallets = new Set(wallets);
      const newWallets = matchingProfile.wallets
        .map(w => w.address)
        .filter(address => !existingWallets.has(address));
      
      if (newWallets.length > 0) {
        setWallets([...wallets, ...newWallets]);
      }
    }
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
          <AutoComplete
            id="twitter"
            value={twitter}
            suggestions={twitterSuggestions}
            completeMethod={searchTwitterHandles}
            onChange={e => setTwitter(e.value)}
            onSelect={e => onTwitterSelect(e.value)}
            placeholder="@username"
            className="w-full"
            aria-label="Twitter"
          />
        </div>

        <div className="field">
          <label htmlFor="discord">Discord</label>
          <AutoComplete
            id="discord"
            value={discord}
            suggestions={discordSuggestions}
            completeMethod={searchDiscordHandles}
            onChange={e => setDiscord(e.value)}
            onSelect={e => onDiscordSelect(e.value)}
            placeholder="username#1234"
            className="w-full"
            aria-label="Discord"
          />
        </div>

        <div className="field">
          <label htmlFor="comment">Comment/Note</label>
          <AutoComplete
            id="comment"
            value={comment}
            suggestions={commentSuggestions}
            completeMethod={searchComments}
            onChange={e => setComment(e.value)}
            onSelect={e => onCommentSelect(e.value)}
            placeholder="Add a note about this profile"
            className="w-full"
            aria-label="Comment"
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
                {wallets.map((wallet, index) => {
                  const isSelected = wallet === selectedWalletAddress;
                  return (
                    <Chip
                      key={index}
                      label={`${wallet.substring(0, 6)}...${wallet.substring(wallet.length - 4)}`}
                      removable
                      onRemove={() => {
                        removeWallet(wallet);
                        return true;
                      }}
                      className={isSelected ? 'highlighted-wallet' : ''}
                      style={isSelected ? { background: '#2196F3', color: 'white' } : undefined}
                    />
                  );
                })}
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
