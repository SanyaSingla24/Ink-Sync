const ContextMenu = ({ x, y, items, onClose }) => (
  <>
    {/* Invisible overlay: click anywhere to close the menu */}
    <div
      className="absolute inset-0 z-30"
      onPointerDown={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
    />
    <div
      className="absolute z-40 bg-white rounded-lg shadow-xl border border-slate-200 py-1 w-48"
      style={{ left: x, top: y }}
      role="menu"
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="h-px bg-slate-200 my-1" />
        ) : (
          <button
            key={item.label}
            role="menuitem"
            disabled={item.disabled}
            className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 flex justify-between items-center disabled:opacity-40"
            onClick={() => { item.action(); onClose(); }}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="text-xs text-slate-400">{item.shortcut}</span>}
          </button>
        )
      )}
    </div>
  </>
);

export default ContextMenu;