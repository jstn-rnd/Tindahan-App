package com.acdc.store;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "BackupFile")
public class BackupFilePlugin extends Plugin {
    private static final String DEFAULT_FILE_NAME = "ACDC-backup.json";

    @PluginMethod
    public void saveBackup(PluginCall call) {
        String contents = call.getString("data");
        if (contents == null) {
            call.reject("Backup data is missing.");
            return;
        }

        String existingUri = call.getString("uri");
        if (existingUri != null && !existingUri.isBlank()) {
            Uri uri = Uri.parse(existingUri);
            try {
                writeDocument(uri, contents);
                call.resolve(fileResult(uri, getDisplayName(uri)));
            } catch (Exception error) {
                call.reject(
                    "The previous backup file is no longer available. Restore access to it or choose a new location.",
                    "BACKUP_LOCATION_UNAVAILABLE",
                    error
                );
            }
            return;
        }

        String fileName = call.getString("fileName");
        if (fileName == null || fileName.isBlank()) fileName = DEFAULT_FILE_NAME;

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );
        startActivityForResult(call, intent, "saveBackupResult");
    }

    @ActivityCallback
    private void saveBackupResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }

        Uri uri = result.getData().getData();
        String contents = call.getString("data");
        if (uri == null || contents == null) {
            call.reject("The backup location could not be opened.");
            return;
        }

        persistAccess(uri, result.getData().getFlags());
        try {
            writeDocument(uri, contents);
            call.resolve(fileResult(uri, getDisplayName(uri)));
        } catch (Exception error) {
            call.reject("The backup could not be saved.", "BACKUP_WRITE_FAILED", error);
        }
    }

    @PluginMethod
    public void openBackup(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );
        startActivityForResult(call, intent, "openBackupResult");
    }

    @ActivityCallback
    private void openBackupResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }

        Uri uri = result.getData().getData();
        if (uri == null) {
            call.reject("The selected backup could not be opened.");
            return;
        }

        persistAccess(uri, result.getData().getFlags());
        try {
            JSObject response = fileResult(uri, getDisplayName(uri));
            response.put("data", readDocument(uri));
            call.resolve(response);
        } catch (Exception error) {
            call.reject("The selected backup could not be read.", "BACKUP_READ_FAILED", error);
        }
    }

    private void writeDocument(Uri uri, String contents) throws Exception {
        try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (stream == null) throw new IllegalStateException("No writable document stream was returned.");
            stream.write(contents.getBytes(StandardCharsets.UTF_8));
            stream.flush();
        }
    }

    private String readDocument(Uri uri) throws Exception {
        try (
            InputStream stream = getContext().getContentResolver().openInputStream(uri);
            ByteArrayOutputStream buffer = new ByteArrayOutputStream()
        ) {
            if (stream == null) throw new IllegalStateException("No readable document stream was returned.");
            byte[] chunk = new byte[8192];
            int bytesRead;
            while ((bytesRead = stream.read(chunk)) != -1) buffer.write(chunk, 0, bytesRead);
            return buffer.toString(StandardCharsets.UTF_8.name());
        }
    }

    private void persistAccess(Uri uri, int resultFlags) {
        int flags = resultFlags & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, flags);
        } catch (SecurityException ignored) {
            // Some document providers grant long-term access without supporting this call.
        }
    }

    private JSObject fileResult(Uri uri, String name) {
        JSObject response = new JSObject();
        response.put("cancelled", false);
        response.put("uri", uri.toString());
        response.put("name", name == null || name.isBlank() ? DEFAULT_FILE_NAME : name);
        return response;
    }

    private String getDisplayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) return cursor.getString(index);
            }
        }
        return DEFAULT_FILE_NAME;
    }
}
