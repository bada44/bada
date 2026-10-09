package com.retrohub.app;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;

@CapacitorPlugin(name = "EmuLauncher")
public class EmuLauncherPlugin extends Plugin {

    // Klasor sec (SAF). Kalici okuma izni alinir.
    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, i, "pickFolderResult");
    }

    @ActivityCallback
    private void pickFolderResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("cancelled");
            return;
        }
        Uri uri = result.getData().getData();
        getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        JSObject o = new JSObject();
        o.put("uri", uri.toString());
        call.resolve(o);
    }

    // Klasoru (alt klasorler dahil) tarar, uzantiya uyan dosyalari dondurur.
    @PluginMethod
    public void scan(PluginCall call) {
        String tree = call.getString("uri");
        JSArray exts = call.getArray("exts");
        if (tree == null || exts == null) { call.reject("uri/exts eksik"); return; }
        DocumentFile root = DocumentFile.fromTreeUri(getContext(), Uri.parse(tree));
        if (root == null || !root.isDirectory()) { call.reject("Klasor okunamadi (izin gitmis olabilir, yeniden sec)"); return; }
        JSArray out = new JSArray();
        try {
            walk(root, exts, out, 0);
        } catch (Exception e) {
            call.reject("Tarama hatasi: " + e.getMessage());
            return;
        }
        JSObject res = new JSObject();
        res.put("files", out);
        call.resolve(res);
    }

    private void walk(DocumentFile dir, JSArray exts, JSArray out, int depth) throws Exception {
        if (depth > 6) return;
        DocumentFile[] list = dir.listFiles();
        for (DocumentFile f : list) {
            if (f.isDirectory()) { walk(f, exts, out, depth + 1); continue; }
            String name = f.getName();
            if (name == null) continue;
            String lower = name.toLowerCase(Locale.ROOT);
            if (lower.contains(".orig.")) continue;
            for (int i = 0; i < exts.length(); i++) {
                if (lower.endsWith(exts.getString(i))) {
                    JSObject o = new JSObject();
                    o.put("name", name);
                    o.put("uri", f.getUri().toString());
                    out.put(o);
                    break;
                }
            }
        }
    }

    @PluginMethod
    public void isInstalled(PluginCall call) {
        String pkg = call.getString("package");
        JSObject o = new JSObject();
        try {
            getContext().getPackageManager().getPackageInfo(pkg, 0);
            o.put("installed", true);
        } catch (PackageManager.NameNotFoundException e) {
            o.put("installed", false);
        }
        call.resolve(o);
    }

    // Emulatoru oyunla baslatir. Dolphin: AutoStartFile, NetherSX2/AetherSX2: bootPath.
    @PluginMethod
    public void launch(PluginCall call) {
        String pkg = call.getString("package");
        String activity = call.getString("activity");
        String extraKey = call.getString("extraKey");
        String uriStr = call.getString("uri");
        if (pkg == null || activity == null || extraKey == null || uriStr == null) { call.reject("Eksik parametre"); return; }
        try {
            Uri uri = Uri.parse(uriStr);
            Intent i = new Intent(Intent.ACTION_MAIN);
            i.setComponent(new ComponentName(pkg, activity));
            i.putExtra(extraKey, uriStr);
            i.setData(uri);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            getContext().grantUriPermission(pkg, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Emulator baslatilamadi: " + e.getMessage());
        }
    }
}
