/* File: src/components/account/AccountPasswordSection.js */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock } from '@fortawesome/free-solid-svg-icons';

// No direct imports of InputField, Button, Alert from a '/ui/' directory

const AccountPasswordSection = ({
    currentPasswordForPassword,
    setCurrentPasswordForPassword,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    passwordUpdateLoading,
    passwordUpdateError,
    passwordUpdateSuccess,
    handlePasswordUpdate,
    // UI Components passed as props
    InputFieldComponent,
    ButtonComponent,
    AlertComponent,
}) => {
    // Use the passed-in components. It's common to rename them locally for convenience.
    const InputField = InputFieldComponent;
    const Button = ButtonComponent;
    const Alert = AlertComponent;

    // It's good practice to add a check in case the components aren't passed,
    // though in this controlled refactor, they should be.
    if (!InputField || !Button || !Alert) {
        console.error("AccountPasswordSection: Required UI component props (InputFieldComponent, ButtonComponent, AlertComponent) were not provided.");
        return <div className="text-red-500 p-4">Error: UI components for this section are missing.</div>;
    }

    return (
        <>
            <Alert
                type="success"
                message={passwordUpdateSuccess ? "Password updated successfully!" : null}
            />
            {/* General error message for re-authentication issues, etc. */}
            <Alert
                type="error"
                message={passwordUpdateError &&
                         !passwordUpdateError.toLowerCase().includes("password") && // Check specific error types to avoid redundant display
                         !passwordUpdateError.toLowerCase().includes("match") &&
                         !passwordUpdateError.toLowerCase().includes("characters")
                         ? passwordUpdateError
                         : null}
            />

            <form onSubmit={handlePasswordUpdate} noValidate className="space-y-4">
                <InputField
                    id="currentPasswordForPassword"
                    label="Current Password"
                    type="password"
                    value={currentPasswordForPassword}
                    onChange={(e) => setCurrentPasswordForPassword(e.target.value)}
                    required
                    placeholder="Enter your current password"
                    disabled={passwordUpdateLoading}
                    error={passwordUpdateError && passwordUpdateError.toLowerCase().includes("current password") ? passwordUpdateError : null}
                />
                <InputField
                    id="newPassword"
                    label="New Password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Minimum 6 characters"
                    disabled={passwordUpdateLoading}
                    error={passwordUpdateError && passwordUpdateError.toLowerCase().includes("characters") ? passwordUpdateError : null}
                />
                <InputField
                    id="confirmNewPassword"
                    label="Confirm New Password"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    placeholder="Re-enter your new password"
                    disabled={passwordUpdateLoading}
                    error={passwordUpdateError && passwordUpdateError.toLowerCase().includes("match") ? passwordUpdateError : null}
                />

                <div className="flex justify-end">
                    <Button
                        type="submit"
                        text="Update Password"
                        color="indigo"
                        icon={faLock}
                        isLoading={passwordUpdateLoading}
                        loadingText="Updating Password..."
                        disabled={passwordUpdateLoading || !currentPasswordForPassword || !newPassword || !confirmNewPassword}
                        fullWidth={false}
                    />
                </div>
            </form>
        </>
    );
};

export default AccountPasswordSection;