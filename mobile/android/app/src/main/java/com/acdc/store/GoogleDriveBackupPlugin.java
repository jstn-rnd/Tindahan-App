package com.acdc.store;

import android.accounts.Account;
import android.app.Activity;
import android.content.Intent;
import android.content.IntentSender;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.identity.RevokeAccessRequest;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URLEncoder;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@CapacitorPlugin(name = "GoogleDriveBackup", requestCodes = { GoogleDriveBackupPlugin.AUTH_REQUEST_CODE })
public class GoogleDriveBackupPlugin extends Plugin {
    static final int AUTH_REQUEST_CODE = 48217;

    private static final String DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
    private static final String EMAIL_SCOPE = "email";
    private static final String OPENID_SCOPE = "openid";
    private static final String GOOGLE_ACCOUNT_TYPE = "com.google";
    private static final String BACKUP_NAME = "ACDC-backup.json";
    private static final String BACKUP_QUERY = "appProperties has { key='acdcBackup' and value='primary' } and trashed=false";
    private static final List<Scope> REQUESTED_SCOPES = Arrays.asList(
        new Scope(DRIVE_FILE_SCOPE),
        new Scope(EMAIL_SCOPE),
        new Scope(OPENID_SCOPE)
    );

    private String pendingAction;
    private String pendingEmail;
    private String pendingData;
    private String pendingFileId;

    @PluginMethod
    public void verifyEmail(PluginCall call) {
        String email = normalizedEmail(call.getString("email"));
        if (email == null) {
            call.reject("Enter a valid Google email address.", "INVALID_EMAIL");
            return;
        }
        authorize(call, "verify", email, null, null, true);
    }

    @PluginMethod
    public void saveBackup(PluginCall call) {
        String email = normalizedEmail(call.getString("email"));
        String data = call.getString("data");
        if (email == null || data == null) {
            call.reject("The verified email and backup data are required.", "INVALID_BACKUP_REQUEST");
            return;
        }
        authorize(call, "save", email, data, call.getString("fileId"), false);
    }

    @PluginMethod
    public void openBackup(PluginCall call) {
        String email = normalizedEmail(call.getString("email"));
        if (email == null) {
            call.reject("Verify a Google email before restoring from Drive.", "INVALID_EMAIL");
            return;
        }
        authorize(call, "open", email, null, call.getString("fileId"), false);
    }

    @PluginMethod
    public void removeAccount(PluginCall call) {
        String email = normalizedEmail(call.getString("email"));
        if (email == null) {
            call.reject("There is no verified Google account to remove.", "INVALID_EMAIL");
            return;
        }
        RevokeAccessRequest request = RevokeAccessRequest.builder()
            .setAccount(new Account(email, GOOGLE_ACCOUNT_TYPE))
            .setScopes(REQUESTED_SCOPES)
            .build();
        Identity.getAuthorizationClient(getActivity())
            .revokeAccess(request)
            .addOnSuccessListener(unused -> call.resolve())
            .addOnFailureListener(error -> call.reject(
                "Google access could not be removed. Check the internet connection and try again.",
                "GOOGLE_REVOKE_FAILED",
                error
            ));
    }

    private void authorize(
        PluginCall call,
        String action,
        String email,
        String data,
        String fileId,
        boolean chooseAccount
    ) {
        if (getSavedCall() != null) {
            call.reject("Another Google Drive request is already in progress.", "GOOGLE_REQUEST_BUSY");
            return;
        }

        pendingAction = action;
        pendingEmail = email;
        pendingData = data;
        pendingFileId = fileId;
        saveCall(call);

        AuthorizationRequest.Builder builder = AuthorizationRequest.builder()
            .setRequestedScopes(REQUESTED_SCOPES);
        if (chooseAccount) builder.setPrompt(AuthorizationRequest.Prompt.SELECT_ACCOUNT);

        Identity.getAuthorizationClient(getActivity())
            .authorize(builder.build())
            .addOnSuccessListener(result -> {
                if (result.hasResolution()) {
                    try {
                        getActivity().startIntentSenderForResult(
                            result.getPendingIntent().getIntentSender(),
                            AUTH_REQUEST_CODE,
                            null,
                            0,
                            0,
                            0
                        );
                    } catch (IntentSender.SendIntentException error) {
                        rejectPending("Google authorization could not be opened.", "GOOGLE_AUTH_FAILED", error);
                    }
                } else {
                    continueAuthorized(result);
                }
            })
            .addOnFailureListener(error -> rejectPending(
                authorizationError(error),
                "GOOGLE_AUTH_FAILED",
                error
            ));
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != AUTH_REQUEST_CODE) return;
        PluginCall call = getSavedCall();
        if (call == null) return;

        if (resultCode != Activity.RESULT_OK || data == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            clearPending();
            return;
        }

        try {
            AuthorizationResult result = Identity.getAuthorizationClient(getActivity())
                .getAuthorizationResultFromIntent(data);
            continueAuthorized(result);
        } catch (ApiException error) {
            rejectPending(authorizationError(error), "GOOGLE_AUTH_FAILED", error);
        }
    }

    private void continueAuthorized(AuthorizationResult result) {
        String token = result.getAccessToken();
        if (token == null || token.isBlank()) {
            rejectPending("Google did not return permission to access Drive.", "GOOGLE_AUTH_FAILED", null);
            return;
        }

        final String action = pendingAction;
        final String expectedEmail = pendingEmail;
        final String backupData = pendingData;
        final String knownFileId = pendingFileId;
        final PluginCall call = getSavedCall();
        if (call == null) return;

        new Thread(() -> {
            try {
                String actualEmail = fetchAuthorizedEmail(token);
                if (!actualEmail.equalsIgnoreCase(expectedEmail)) {
                    throw new PluginOperationException(
                        "The selected Google account is " + actualEmail + ", not " + expectedEmail + ".",
                        "EMAIL_MISMATCH"
                    );
                }

                JSObject response;
                if ("verify".equals(action)) {
                    response = new JSObject();
                    response.put("cancelled", false);
                    response.put("email", actualEmail.toLowerCase(Locale.ROOT));
                } else if ("save".equals(action)) {
                    response = uploadBackup(token, backupData, knownFileId);
                    response.put("email", actualEmail.toLowerCase(Locale.ROOT));
                } else if ("open".equals(action)) {
                    response = downloadBackup(token, knownFileId);
                    response.put("email", actualEmail.toLowerCase(Locale.ROOT));
                } else {
                    throw new PluginOperationException("Unknown Google Drive operation.", "GOOGLE_DRIVE_FAILED");
                }
                call.resolve(response);
                clearPending();
            } catch (PluginOperationException error) {
                rejectPending(error.getMessage(), error.code, error);
            } catch (Exception error) {
                rejectPending(
                    "Google Drive could not complete the request. Check the connection and try again.",
                    "GOOGLE_DRIVE_FAILED",
                    error
                );
            }
        }, "acdc-drive-backup").start();
    }

    private String fetchAuthorizedEmail(String token) throws Exception {
        HttpResponse response = request(
            "GET",
            "https://www.googleapis.com/oauth2/v3/userinfo",
            token,
            null,
            null
        );
        ensureSuccess(response, "Google account details could not be verified.");
        String email = new JSONObject(response.body).optString("email", "");
        if (email.isBlank()) {
            throw new PluginOperationException("Google did not return an email address.", "EMAIL_NOT_AVAILABLE");
        }
        return email;
    }

    private JSObject uploadBackup(String token, String data, String knownFileId) throws Exception {
        if (data == null) throw new PluginOperationException("Backup data is missing.", "INVALID_BACKUP_REQUEST");
        String fileId = usable(knownFileId) ? knownFileId : findBackupFile(token);
        HttpResponse response = null;

        if (fileId != null) {
            response = request(
                "PATCH",
                "https://www.googleapis.com/upload/drive/v3/files/" + encodePath(fileId) + "?uploadType=media&fields=id,name,modifiedTime",
                token,
                "application/json; charset=UTF-8",
                data.getBytes(StandardCharsets.UTF_8)
            );
            if (response.code == 404) fileId = null;
            else ensureSuccess(response, "The existing Google Drive backup could not be updated.");
        }

        if (fileId == null) {
            String boundary = "acdc-backup-boundary-" + System.currentTimeMillis();
            JSONObject metadata = new JSONObject();
            metadata.put("name", BACKUP_NAME);
            metadata.put("mimeType", "application/json");
            metadata.put("appProperties", new JSONObject().put("acdcBackup", "primary"));
            String body = "--" + boundary + "\r\n"
                + "Content-Type: application/json; charset=UTF-8\r\n\r\n"
                + metadata + "\r\n"
                + "--" + boundary + "\r\n"
                + "Content-Type: application/json; charset=UTF-8\r\n\r\n"
                + data + "\r\n"
                + "--" + boundary + "--";
            response = request(
                "POST",
                "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime",
                token,
                "multipart/related; boundary=" + boundary,
                body.getBytes(StandardCharsets.UTF_8)
            );
            ensureSuccess(response, "A Google Drive backup file could not be created.");
        }

        if (response == null) {
            throw new PluginOperationException("Google Drive did not return the backup file.", "DRIVE_FILE_MISSING");
        }
        JSONObject file = new JSONObject(response.body);
        String savedId = file.optString("id", fileId == null ? "" : fileId);
        if (savedId.isBlank()) throw new PluginOperationException("Google Drive did not return the backup file.", "DRIVE_FILE_MISSING");
        JSObject result = new JSObject();
        result.put("cancelled", false);
        result.put("fileId", savedId);
        result.put("name", file.optString("name", BACKUP_NAME));
        return result;
    }

    private JSObject downloadBackup(String token, String knownFileId) throws Exception {
        String fileId = usable(knownFileId) ? knownFileId : findBackupFile(token);
        if (fileId == null) {
            throw new PluginOperationException("No ACDC backup was found in this Google Drive.", "DRIVE_BACKUP_NOT_FOUND");
        }
        HttpResponse response = request(
            "GET",
            "https://www.googleapis.com/drive/v3/files/" + encodePath(fileId) + "?alt=media",
            token,
            null,
            null
        );
        if (response.code == 404 && usable(knownFileId)) {
            fileId = findBackupFile(token);
            if (fileId == null) {
                throw new PluginOperationException("No ACDC backup was found in this Google Drive.", "DRIVE_BACKUP_NOT_FOUND");
            }
            response = request(
                "GET",
                "https://www.googleapis.com/drive/v3/files/" + encodePath(fileId) + "?alt=media",
                token,
                null,
                null
            );
        }
        ensureSuccess(response, "The Google Drive backup could not be downloaded.");
        JSObject result = new JSObject();
        result.put("cancelled", false);
        result.put("fileId", fileId);
        result.put("name", BACKUP_NAME);
        result.put("data", response.body);
        return result;
    }

    private String findBackupFile(String token) throws Exception {
        String url = "https://www.googleapis.com/drive/v3/files?spaces=drive&pageSize=1&orderBy=modifiedTime%20desc"
            + "&fields=files(id,name,modifiedTime)&q="
            + URLEncoder.encode(BACKUP_QUERY, StandardCharsets.UTF_8.name());
        HttpResponse response = request("GET", url, token, null, null);
        ensureSuccess(response, "Google Drive could not search for the ACDC backup.");
        JSONArray files = new JSONObject(response.body).optJSONArray("files");
        if (files == null || files.length() == 0) return null;
        return files.getJSONObject(0).optString("id", null);
    }

    private HttpResponse request(
        String method,
        String urlValue,
        String token,
        String contentType,
        byte[] body
    ) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(urlValue).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(30000);
        connection.setRequestProperty("Authorization", "Bearer " + token);
        connection.setRequestProperty("Accept", "application/json");
        if (contentType != null) connection.setRequestProperty("Content-Type", contentType);
        if (body != null) {
            connection.setDoOutput(true);
            connection.setFixedLengthStreamingMode(body.length);
            try (OutputStream stream = connection.getOutputStream()) {
                stream.write(body);
            }
        }
        int code = connection.getResponseCode();
        InputStream stream = code >= 200 && code < 400
            ? connection.getInputStream()
            : connection.getErrorStream();
        String responseBody = stream == null ? "" : readStream(stream);
        connection.disconnect();
        return new HttpResponse(code, responseBody);
    }

    private String readStream(InputStream stream) throws Exception {
        try (InputStream input = stream; ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
            byte[] chunk = new byte[8192];
            int read;
            while ((read = input.read(chunk)) != -1) buffer.write(chunk, 0, read);
            return buffer.toString(StandardCharsets.UTF_8.name());
        }
    }

    private void ensureSuccess(HttpResponse response, String fallbackMessage) throws PluginOperationException {
        if (response.code >= 200 && response.code < 300) return;
        String message = fallbackMessage;
        try {
            JSONObject error = new JSONObject(response.body).optJSONObject("error");
            if (error != null && !error.optString("message").isBlank()) message = error.optString("message");
        } catch (Exception ignored) {
            // Use the short, user-friendly fallback when Google did not return JSON.
        }
        throw new PluginOperationException(message, "GOOGLE_DRIVE_HTTP_" + response.code);
    }

    private String authorizationError(Exception error) {
        if (error instanceof ApiException && ((ApiException) error).getStatusCode() == 10) {
            return "Google OAuth is not configured for this ACDC build. Register com.acdc.store and its signing certificate in Google Cloud.";
        }
        return "Google authorization failed. Check Google Play services and try again.";
    }

    private String normalizedEmail(String value) {
        if (value == null) return null;
        String email = value.trim().toLowerCase(Locale.ROOT);
        if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) return null;
        return email;
    }

    private boolean usable(String value) {
        return value != null && !value.isBlank();
    }

    private String encodePath(String value) throws Exception {
        return URLEncoder.encode(value, StandardCharsets.UTF_8.name()).replace("+", "%20");
    }

    private synchronized void rejectPending(String message, String code, Exception error) {
        PluginCall call = getSavedCall();
        if (call == null) return;
        if (error == null) call.reject(message, code);
        else call.reject(message, code, error);
        clearPending();
    }

    private synchronized void clearPending() {
        PluginCall call = getSavedCall();
        if (call != null) freeSavedCall();
        pendingAction = null;
        pendingEmail = null;
        pendingData = null;
        pendingFileId = null;
    }

    private static final class HttpResponse {
        final int code;
        final String body;

        HttpResponse(int code, String body) {
            this.code = code;
            this.body = body;
        }
    }

    private static final class PluginOperationException extends Exception {
        final String code;

        PluginOperationException(String message, String code) {
            super(message);
            this.code = code;
        }
    }
}
