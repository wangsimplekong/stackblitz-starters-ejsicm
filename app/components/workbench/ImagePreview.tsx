import { useState } from 'react';

interface ImagePreviewProps {
  src: string;
}

export default function ImagePreview({ src }: ImagePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleImageClick = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <img
        src={src}
        alt="Preview"
        onClick={handleImageClick}
        className="cursor-pointer max-w-full h-auto"
      />
      
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
          onClick={handleClose}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={src}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain"
            />
            <button
              className="absolute top-4 right-4 text-white bg-gray-800 rounded-full p-2 hover:bg-gray-700"
              onClick={handleClose}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
} 