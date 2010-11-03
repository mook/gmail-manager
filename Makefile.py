#!/usr/bin/env python

"""
  Makefile to build an XPI install bundle for GMail Manager

  This exists to try to build an XPI for GMail Manager, taking care to package
  the various chrome files into a jar for performance reasons.  It also deals
  with munging the chrome.manifest so it is still possible to run in development
  mode against an "uninstalled" build.
"""

VERSION = "0.1"

import os, shutil, subprocess, time, zipfile

# Clean out previous build
if os.path.exists(".xpi-stage"):
    shutil.rmtree(".xpi-stage")

# Create the staging area
os.mkdir(".xpi-stage", 493) # 0o755

# Build the chrome jar
jar = zipfile.ZipFile(os.path.join(".xpi-stage", "gmanager.jar"),
                      "w",
                      zipfile.ZIP_DEFLATED)
for (dirpath, dirnames, filenames) in os.walk("chrome"):
    for filename in filenames:
        pathname = os.path.join(dirpath, filename)
        jar.write(pathname, pathname.replace("chrome" + os.sep, "", 1))
jar.close()

# Copy other files to staing
for file in ["install.rdf", "license.txt"]:
    shutil.copyfile(file, os.path.join(".xpi-stage", file))
for dir in ["components", "defaults"]:
    os.mkdir(os.path.join(".xpi-stage", dir))
    for (dirpath, dirnames, filenames) in os.walk(dir):
        for dirname in dirnames:
            os.mkdir(os.path.join(".xpi-stage", dirpath, dirname))
        for filename in filenames:
            if filename.endswith(".idl"):
                # no need to ship IDL files
                continue
            pathname = os.path.join(dirpath, filename)
            shutil.copyfile(pathname, os.path.join(".xpi-stage", pathname))

# Figure out if we have xpidl
xpidl_bin = None
idl_path = None
if 'PATHEXT' in os.environ:
    exeexts = os.environ['PATHEXT'].split(os.path.pathsep)
else:
    exeexts = ['']
for exeext in exeexts:
    if xpidl_bin is not None:
        break
    for dir in os.environ['PATH'].split(os.path.pathsep):
        if os.access(os.path.join(dir, "xpidl" + exeext), os.X_OK):
            xpidl_bin = os.path.join(dir, "xpidl" + exeext)
            break

# Figure out where the XULRunner base interface definitions are
if xpidl_bin is not None:
    # we have xpidl; find the idl files
    for dir in [os.path.join(os.path.pardir, "idl")]:
        nsISupports = os.path.normpath(os.path.join(os.path.dirname(xpidl_bin),
                                                    dir,
                                                    "nsISupports.idl"))
        if os.path.exists(nsISupports):
            idl_path = os.path.dirname(nsISupports)
            break

# Rebuild xptypelib from xpidl files
if xpidl_bin is not None and idl_path is not None:
    for (dirpath, dirnames, filenames) in os.walk("components"):
        for filename in filenames:
            if not filename.endswith(".idl"):
                continue
            args = ["xpidl", "-m", "typelib", "-w",
                    "-I", "components",
                    "-I", idl_path,
                    "-o", os.path.join(".xpi-stage", "components", filename[:-4]),
                    os.path.join(dirpath, filename)]
            result = subprocess.call(args)
            assert(result == 0)

# Munge chrome manifest for jar
output = open(os.path.join(".xpi-stage", "chrome.manifest"), "w")
for line in open("chrome.manifest", "r"):
    line = line.strip()
    args = line.split()
    if len(args) > 0:
        idx = 0
        if args[0] == "content":
            idx = 2
        elif args[0] == "skin" or args[0] == "locale":
            idx = 3
        if args[idx].startswith("chrome/"):
            args[idx] = args[idx].replace("chrome/", "jar:gmanager.jar!/", 1)
        output.write(" ".join(args) + "\n")
    else:
        output.write(line + "\n")
output.close()

# Munge install.rdf version
output = open(os.path.join(".xpi-stage", "install.rdf"), "w")
for line in open("install.rdf", "r"):
    line = line.rstrip()
    index = line.find("</em:version>")
    if index != -1:
        username = ('USERNAME' in os.environ and os.environ['USERNAME'] or
                    'USER' in os.environ and os.environ['USER'] or
                    False)

        line = "".join([line[:index],
                        ".", VERSION, ".",
                        time.strftime("%Y%m%d"),
                        username and ("." + username.lower()) or "",
                        line[index:]])
    output.write(line + "\n")
output.close()

# Build XPI
xpi = zipfile.ZipFile(os.path.join(".xpi-stage", "gmanager.xpi"),
                      "w",
                      zipfile.ZIP_DEFLATED)
for (dirpath, dirnames, filenames) in os.walk(".xpi-stage"):
    for filename in filenames:
        if filename == "gmanager.xpi":
            # don't try to zip up the xpi itself
            continue
        pathname = os.path.join(dirpath, filename)
        xpi.write(pathname, pathname.replace(".xpi-stage" + os.sep, "", 1))
xpi.close()

print("Build complete.")
