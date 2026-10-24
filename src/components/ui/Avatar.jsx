import React, { useState } from 'react';
import { User as UserIcon } from 'lucide-react';
import { avatarUrl } from '../../services/api';

/**
 * Profile picture with an initial fallback (no photo, mock mode, or the image failed to load).
 * Size/shape come from `className`; the photo is purely decorative because the name is always
 * shown next to it.
 */
export default function Avatar({ user, className = 'w-8 h-8 rounded-full', textClass = 'text-xs' }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const src = avatarUrl(user?._id, user?.avatarUpdatedAt);
  const showPhoto = Boolean(src) && failedSrc !== src;

  return (
    <div
      className={`bg-slate-200 text-slate-700 flex items-center justify-center font-semibold overflow-hidden select-none ${textClass} ${className}`}
    >
      {showPhoto ? (
        <img
          src={src}
          alt=""
          draggable={false}
          onError={() => setFailedSrc(src)}
          className="w-full h-full object-cover"
        />
      ) : user?.name ? (
        user.name.charAt(0).toUpperCase()
      ) : (
        <UserIcon className="w-4 h-4" />
      )}
    </div>
  );
}
