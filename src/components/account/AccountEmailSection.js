/* File: src/components/account/AccountEmailSection.js */
/* Updated: Cognitive Lab dark theme */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faExclamationTriangle, faPaperPlane } from '@fortawesome/free-solid-svg-icons';

const AccountEmailSection = ({
    authUser,
    newEmail,
    setNewEmail,
    currentPasswordForEmail,
    setCurrentPasswordForEmail,
    emailUpdateLoading,
    emailUpdateError,
    emailUpdateSuccess,
    handleEmailUpdate,
    isSendingVerification,
    verificationMessage,
    verificationMessageType,
    handleSendVerificationEmail,
    // UI Components passed as props
    InputFieldComponent,
    ButtonComponent,
    AlertComponent,
    StatusBadgeComponent,
}) => {
    const InputField = InputFieldComponent;
    const Button = ButtonComponent;
    const Alert = AlertComponent;
    const StatusBadge = StatusBadgeComponent;

    if (!authUser) {
        return null;
    }

    if (!InputField || !Button || !Alert || !StatusBadge) {
        console.error("AccountEmailSection: Required UI component props were not provided.");
        return <div className="text-neural-synapse p-4 font-mono">Error: UI components for this section are missing.</div>;
    }

    return (
        <>
            {/* Current Email Display & Verification Status */}
            <div className="mb-6 p-4 bg-theme-bg-elevated rounded-lab border border-theme-line">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1">
                        <p className="text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-1">Current Email</p>
                        <p className="font-mono text-theme-text break-all">{authUser.email}</p>
                    </div>
                    <div className="sm:text-right">
                        {authUser.emailVerified ? (
                            <StatusBadge type="success" text="Verified" />
                        ) : (
                            <StatusBadge type="warning" text="Not Verified" />
                        )}
                    </div>
                </div>
            </div>

            {/* EMAIL VERIFICATION CALLOUT (only if not verified) */}
            {!authUser.emailVerified && (
                <div className="mb-6 p-4 border border-theme-accent/30 bg-theme-accent/10 rounded-lab">
                    <h4 className="text-sm font-mono text-theme-accent mb-2 flex items-center">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2 h-4 w-4" />
                        Verify Your Email Address
                    </h4>
                    <p className="text-sm text-theme-text-muted font-mono mb-4">
                        Verifying your email helps secure your account and ensures you receive important updates.
                    </p>
                    <Alert type={verificationMessageType} message={verificationMessage} />
                    {(!verificationMessage || verificationMessageType === 'error') && (
                        <Button
                            onClick={handleSendVerificationEmail}
                            text="Send Verification Email"
                            variant="secondary"
                            icon={faPaperPlane}
                            isLoading={isSendingVerification}
                            loadingText="Sending..."
                            disabled={isSendingVerification}
                        />
                    )}
                </div>
            )}

            <Alert
                type="success"
                message={emailUpdateSuccess ? "Email updated successfully! Please check your new email for verification." : null}
            />
            <Alert
                type="error"
                message={emailUpdateError && !emailUpdateError.toLowerCase().includes("email") && !emailUpdateError.toLowerCase().includes("password") ? emailUpdateError : null}
            />

            <form onSubmit={handleEmailUpdate} noValidate className="space-y-4">
                <InputField
                    id="newEmail"
                    label="New Email Address"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    placeholder="Enter new email address"
                    disabled={emailUpdateLoading}
                    error={emailUpdateError && emailUpdateError.toLowerCase().includes("email") ? emailUpdateError : null}
                />
                <InputField
                    id="currentPasswordForEmail"
                    label="Current Password"
                    type="password"
                    value={currentPasswordForEmail}
                    onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
                    required
                    placeholder="Enter your current password"
                    disabled={emailUpdateLoading}
                    error={emailUpdateError && emailUpdateError.toLowerCase().includes("password") ? emailUpdateError : null}
                />

                <div className="flex justify-end pt-2">
                    <Button
                        type="submit"
                        text="Update Email"
                        variant="primary"
                        icon={faEnvelope}
                        isLoading={emailUpdateLoading}
                        loadingText="Updating..."
                        disabled={emailUpdateLoading || !newEmail || !currentPasswordForEmail}
                        fullWidth={false}
                    />
                </div>
            </form>
        </>
    );
};

export default AccountEmailSection;
