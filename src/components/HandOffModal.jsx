import { X, ArrowRightLeft } from 'lucide-react'

const SHIFT_LABELS = { AM: 'Morning', 'Mid-Day': 'Mid-Day', PM: 'Evening' }

export default function HandOffModal({ shift, dateStr, users, currentUserId, onClose, onSubmit }) {
  const otherUsers = users.filter((u) => u.id !== currentUserId)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center animate-fade-in">
      <div className="bg-neutral-900 border-t border-neutral-700 rounded-t-2xl w-full max-w-lg p-5 pb-8 animate-slide-up safe-area-bottom">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-neutral-100">Hand Off Shift</h3>
          </div>
          <button onClick={onClose} className="p-2">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
        <p className="text-sm text-neutral-400 mb-4">
          Hand off your <span className="font-medium text-neutral-200">{SHIFT_LABELS[shift] || shift}</span> shift on <span className="font-medium text-neutral-200">{dateStr}</span>
        </p>
        <p className="text-xs text-neutral-500 mb-3">Select who you want to cover for you:</p>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {otherUsers.map((user) => (
            <button
              key={user.id}
              onClick={() => onSubmit(user.id)}
              className="w-full text-left px-4 py-3 rounded-xl hover:bg-neutral-800 text-sm text-neutral-300 transition active:scale-[0.98]"
            >
              {user.display_name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
