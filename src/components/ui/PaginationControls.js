/* src/components/ui/PaginationControls.js */
import React from 'react';

const PaginationControls = ({
    currentPage,
    totalPages,
    onPageChange,
    itemsPerPage,
    onItemsPerPageChange,
    totalItems,
    itemsPerPageOptions = [5, 10, 25, 50],
}) => {
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    const handlePrevious = () => {
        if (currentPage > 1) {
            onPageChange(currentPage - 1);
        }
    };

    const handleNext = () => {
        if (currentPage < totalPages) {
            onPageChange(currentPage + 1);
        }
    };

    const handleSelectChange = (event) => {
        onItemsPerPageChange(Number(event.target.value));
    };

    if (totalPages <= 1 && totalItems <= itemsPerPageOptions[0]) {
        return null;
    }

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left Side: Items per page selector - Lab instrument style */}
            <div className="flex items-center gap-2">
                <label htmlFor="itemsPerPage" className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.15em] font-mono">
                    Display:
                </label>
                <select
                    id="itemsPerPage"
                    value={itemsPerPage}
                    onChange={handleSelectChange}
                    className="bg-theme-bg-secondary border border-theme-line text-theme-text px-2 py-1 text-xs font-mono focus:ring-1 focus:ring-theme-accent/50 focus:border-theme-accent rounded-none appearance-none cursor-pointer"
                    aria-label="Items per page"
                >
                    {itemsPerPageOptions.map(option => (
                        <option key={option} value={option} className="bg-theme-bg-secondary">
                            {option}
                        </option>
                    ))}
                </select>
                <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.15em] font-mono">entries</span>
            </div>

            {/* Right Side: Page info and Navigation */}
            <div className="flex items-center gap-4">
                {/* Page Info */}
                <p className="text-xs text-theme-text-secondary font-mono hidden sm:block">
                    <span className="text-theme-text-muted">Records</span>{' '}
                    <span className="text-theme-accent">{startItem}</span>
                    <span className="text-theme-text-muted">–</span>
                    <span className="text-theme-accent">{endItem}</span>
                    <span className="text-theme-text-muted"> of </span>
                    <span className="text-theme-text">{totalItems}</span>
                </p>

                {/* Navigation Buttons - Lab instrument style */}
                <nav className="inline-flex items-center" aria-label="Pagination">
                    <button
                        onClick={handlePrevious}
                        disabled={currentPage === 1}
                        className="inline-flex items-center justify-center w-8 h-8 border border-theme-line bg-theme-bg-secondary text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-theme-accent/50 transition-colors"
                        aria-label="Previous page"
                    >
                        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <span className="inline-flex items-center justify-center px-4 h-8 border-t border-b border-theme-line bg-theme-bg-elevated text-xs font-mono text-theme-text">
                        <span className="text-theme-text-muted mr-1">Pg</span>
                        <span className="text-theme-accent">{currentPage}</span>
                        <span className="text-theme-text-muted mx-1">/</span>
                        <span>{totalPages > 0 ? totalPages : 1}</span>
                    </span>
                    <button
                        onClick={handleNext}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="inline-flex items-center justify-center w-8 h-8 border border-theme-line bg-theme-bg-secondary text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-theme-accent/50 transition-colors"
                        aria-label="Next page"
                    >
                        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                </nav>
            </div>
        </div>
    );
};

export default PaginationControls;