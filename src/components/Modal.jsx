import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Modal
 * props:
 *  - isOpen: boolean (열림/닫힘)
 *  - onClose: () => void (닫기 핸들러)
 *  - children: ReactNode (모달 내용)
 *
 * 특징:
 *  - ESC 키로 닫기
 *  - 오버레이 클릭으로 닫기 (컨텐츠 클릭은 닫히지 않음)
 *  - 모달 열릴 때 body 스크롤 잠금
 *  - 접근성 속성(aria-modal, role) 포함
 */
const Modal = ({ isOpen, onClose, children }) => {
    const containerRef = useRef(null);

    // body 스크롤 잠금/해제
    useEffect(() => {
        if (!isOpen) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = original;
        };
    }, [isOpen]);

    // ESC 키 닫기
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => {
            if (e.key === "Escape") onClose?.();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen, onClose]);

    // 최초 포커스
    useEffect(() => {
        if (isOpen && containerRef.current) {
            // 컨테이너로 포커스 이동(단순 포커스 트랩)
            containerRef.current.focus();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const content = (
        <div
            aria-modal="true"
            role="dialog"
            aria-label="Modal dialog"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
                backgroundColor: "rgba(0,0,0,0.5)",
            }}
            onClick={onClose} // 오버레이 클릭 시 닫기
        >
            <div
                ref={containerRef}
                tabIndex={-1}
                style={{
                    background: "#fff",
                    borderRadius: "10px",
                    width: "min(92vw, 560px)",
                    maxHeight: "85vh",
                    overflowY: "auto",
                    padding: "20px",
                    boxShadow:
                        "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)",
                    position: "relative",
                }}
                onClick={(e) => e.stopPropagation()} // 컨텐츠 클릭 시 닫기 방지
            >
                {/* 닫기 버튼 */}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close modal"
                    style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        border: "1px solid #e5e7eb",
                        background: "#f9fafb",
                        cursor: "pointer",
                    }}
                >
                    ✕
                </button>

                {children}
            </div>
        </div>
    );

    return createPortal(content, document.body);
};

export default Modal;