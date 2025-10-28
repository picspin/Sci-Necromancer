import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { SvgIcon } from './SvgIcon';

interface AccessibleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: 'text' | 'image' | 'document' | 'sparkles' | 'loader' | 'info' | 'impact' | 'tag' | 'logo';
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

/**
 * Accessible button component with proper ARIA attributes and keyboard support
 */
export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      iconPosition = 'left',
      loading = false,
      fullWidth = false,
      disabled,
      className = '',
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const baseClasses = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-3 focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses = {
      primary: 'bg-brand-primary hover:bg-brand-secondary text-white',
      secondary: 'bg-base-300 hover:bg-base-300/80 text-white',
      ghost: 'bg-transparent hover:bg-base-300/50 text-text-secondary hover:text-text-primary',
      danger: 'bg-red-600 hover:bg-red-700 text-white',
    };

    const sizeClasses = {
      sm: 'py-1.5 px-3 text-sm min-h-[36px]',
      md: 'py-2.5 px-4 text-base min-h-[44px]',
      lg: 'py-3 px-6 text-lg min-h-[52px]',
    };

    const iconSizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    };

    const widthClass = fullWidth ? 'w-full' : '';

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (loading || disabled) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      // Ensure Enter and Space trigger the button
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!loading && !disabled) {
          onClick?.(e as any);
        }
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
        disabled={disabled || loading}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <SvgIcon 
            type="loader" 
            className={`${iconSizeClasses[size]} animate-spin`}
            aria-hidden="true"
          />
        )}
        {!loading && icon && iconPosition === 'left' && (
          <SvgIcon 
            type={icon} 
            className={iconSizeClasses[size]}
            aria-hidden="true"
          />
        )}
        <span>{children}</span>
        {!loading && icon && iconPosition === 'right' && (
          <SvgIcon 
            type={icon} 
            className={iconSizeClasses[size]}
            aria-hidden="true"
          />
        )}
      </button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';

export default AccessibleButton;
