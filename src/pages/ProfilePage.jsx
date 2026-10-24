import React, { useState, useEffect, useRef } from 'react';
import { User, Eye, EyeOff, Loader2, Camera } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { InlineBanner, LoadingSkeleton } from '../components/ui/StateViews';
import { useToast } from '../components/ui/Toast';
import PasswordChecklist from '../components/ui/PasswordChecklist';
import Avatar from '../components/ui/Avatar';
import { fileToAvatarDataUrl, AVATAR_ACCEPT } from '../utils/image';
import { checkName, checkEmail, checkPassword, collapseSpaces, normalizeEmail, LIMITS } from '../utils/validators';

export default function ProfilePage() {
  const { user, role, refreshUser } = useAuth();
  const toast = useToast();

  // Profile fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Status states
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [profileErrorMessage, setProfileErrorMessage] = useState('');
  const [passwordErrorMessage, setPasswordErrorMessage] = useState('');
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handlePhotoPicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be picked again later
    if (!file) return;
    setIsSavingPhoto(true);
    try {
      const image = await fileToAvatarDataUrl(file);
      await authAPI.setAvatar(user._id, image);
      await refreshUser();
      toast.success('Your profile picture was updated.', { title: 'Changes saved' });
    } catch (err) {
      toast.error(err.errors?.image || err.message || 'Failed to update your profile picture.');
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const handlePhotoRemove = async () => {
    setIsSavingPhoto(true);
    try {
      await authAPI.removeAvatar(user._id);
      await refreshUser();
      toast.success('Your profile picture was removed.', { title: 'Changes saved' });
    } catch (err) {
      toast.error(err.message || 'Failed to remove your profile picture.');
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const isProfileDirty =
    !user || collapseSpaces(name) !== (user.name || '') || normalizeEmail(email) !== (user.email || '').toLowerCase();

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!isProfileDirty) return;
    setProfileErrorMessage('');

    const profileErr = checkName(name) || checkEmail(email);
    if (profileErr) {
      setProfileErrorMessage(profileErr);
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await authAPI.updateUserProfile(user._id, {
        name: collapseSpaces(name),
        email: normalizeEmail(email),
      });
      await refreshUser();
      toast.success('Your profile details were updated.', { title: 'Changes saved' });
    } catch (err) {
      if (err.status === 409) {
        setProfileErrorMessage('This email is already in use by another account.');
      } else {
        setProfileErrorMessage(err.message || 'Failed to update profile.');
      }
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordErrorMessage('');

    if (!currentPassword) {
      setPasswordErrorMessage('Current password is required.');
      return;
    }

    const newPasswordErr = checkPassword(newPassword);
    if (newPasswordErr) {
      setPasswordErrorMessage(`New password: ${newPasswordErr.charAt(0).toLowerCase()}${newPasswordErr.slice(1)}.`);
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordErrorMessage('New password must be different from the current one.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMessage('New passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await authAPI.updateUserProfile(user._id, {
        password: newPassword,
        currentPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Your password was updated.', { title: 'Changes saved' });
    } catch (err) {
      if (err.status === 401) {
        setPasswordErrorMessage('Incorrect current password.');
      } else {
        setPasswordErrorMessage(err.message || 'Failed to update password.');
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="p-8 max-w-3xl mx-auto w-full">
        <LoadingSkeleton variant="profile" />
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-8 max-w-3xl mx-auto">
      {/* Top Header: Avatar + Name + Role Badge */}
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-3">
          <Avatar
            user={user}
            className="w-24 h-24 rounded-full shadow-sm"
            textClass="text-3xl"
          />
          {isSavingPhoto && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white-fixed animate-spin" />
            </div>
          )}
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {user.name}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
        <span className="mt-2 px-3 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-100 text-slate-700">
          {role}
        </span>

        <div className="mt-3 flex items-center gap-2">
          <input
            ref={photoInputRef}
            type="file"
            accept={AVATAR_ACCEPT}
            onChange={handlePhotoPicked}
            className="hidden"
            aria-label="Choose a profile picture"
          />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={isSavingPhoto}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Camera className="w-3.5 h-3.5 text-slate-500" />
            <span>{user.avatarUpdatedAt ? 'Change photo' : 'Add photo'}</span>
          </button>
          {user.avatarUpdatedAt && (
            <button
              type="button"
              onClick={handlePhotoRemove}
              disabled={isSavingPhoto}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Two clean side-by-side white cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Card 1: Profile Details */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Profile Details
          </h2>

          {profileErrorMessage && (
            <InlineBanner
              type="error"
              message={profileErrorMessage}
              onDismiss={() => setProfileErrorMessage('')}
            />
          )}

          <form onSubmit={handleProfileSubmit} noValidate className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="profile-1">
                Full Name
              </label>
              <input id="profile-1"
                type="text"
                required
                value={name}
                maxLength={LIMITS.NAME_MAX}
                autoComplete="name"
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 transition-all text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="profile-2">
                Email Address
              </label>
              <input id="profile-2"
                type="email"
                required
                value={email}
                maxLength={LIMITS.EMAIL_MAX}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 transition-all text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={isUpdatingProfile || !isProfileDirty}
              title={!isProfileDirty ? 'No changes to save' : undefined}
              className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdatingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </form>
        </div>

        {/* Card 2: Change Password */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Change Password
          </h2>

          {passwordErrorMessage && (
            <InlineBanner
              type="error"
              message={passwordErrorMessage}
              onDismiss={() => setPasswordErrorMessage('')}
            />
          )}

          <form onSubmit={handlePasswordSubmit} noValidate className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="profile-3">
                Current Password
              </label>
              <div className="relative flex items-center">
                <input id="profile-3"
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  maxLength={LIMITS.PASSWORD_MAX_BYTES}
                  autoComplete="current-password"
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full h-11 pl-4 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 transition-all text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  className="absolute right-1 text-slate-400 hover:text-slate-600 p-2.5"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="profile-4">
                New Password
              </label>
              <div className="relative flex items-center">
                <input id="profile-4"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  maxLength={LIMITS.PASSWORD_MAX_BYTES}
                  autoComplete="new-password"
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full h-11 pl-4 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 transition-all text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  className="absolute right-1 text-slate-400 hover:text-slate-600 p-2.5"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordChecklist value={newPassword} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="profile-5">
                Confirm New Password
              </label>
              <input id="profile-5"
                type={showNewPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                maxLength={LIMITS.PASSWORD_MAX_BYTES}
                autoComplete="new-password"
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 transition-all text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isUpdatingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Update Password</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
