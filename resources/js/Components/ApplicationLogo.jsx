export default function ApplicationLogo(props) {
    return (
        <div {...props} className={"flex items-center gap-3 " + (props.className || '')}>
            <div className="w-10 h-10 bg-[#5340FF] rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
            </div>
            <span className="text-[20px] font-extrabold text-[#111827] tracking-tight">DocDrive</span>
        </div>
    );
}
