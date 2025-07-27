from fastapi import FastAPI, UploadFile, File, Request, Body
from fastapi.responses import JSONResponse
from typing import List
import os
from io import BytesIO
from pillow_heif import register_heif_opener
from PIL import Image
from fastapi.staticfiles import StaticFiles
import json
from datetime import datetime
from fastapi import HTTPException

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
register_heif_opener()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#path to image upload folder 
UPLOAD_DIR = "uploads"
#mkae a new folder if none exist on first run
os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/")
def read_root():
    return {"message": "Hello from FastAPI"}


# @app.post("/upload")
# async def upload_image(file: UploadFile = File(...)):
#     # Read the file content into a BytesIO object
#     contents = await file.read()
#     file_buffer = BytesIO(contents)

#     # Open the file buffer as an image using Pillow
#     image = Image.open(file_buffer)

#     # Perform any desired image processing or manipulation here
#     # For example, let's resize the image
#     new_size = (800, 600)
#     resized_image = image.resize(new_size)

#     # Save the modified image
#     output_path = "path/to/output/image.jpg"
#     resized_image.save(output_path)

#     return {"message": "Image uploaded and processed successfully"}



#POST route for uploading files
METADATA_FILE = os.path.join(UPLOAD_DIR, "metadata.json")

def save_metadata(filename, date_taken, ranking=1):
    # Load existing metadata
    if os.path.exists(METADATA_FILE):
        with open(METADATA_FILE, "r") as f:
            metadata = json.load(f)
    else:
        metadata = {}
    # Save or update entry
    metadata[filename] = {"date_taken": date_taken, "ranking": ranking}
    with open(METADATA_FILE, "w") as f:
        json.dump(metadata, f)

@app.post("/upload")
#'files' comes from front end
# File(...) tells FastAPI to expect files from multipart/form-data
async def upload_images(files: List[UploadFile] = File(...)):
    #use list to report back to frontend
    saved_files = []

    try:
        import piexif
    except ImportError:
        piexif = None

    for file in files:
        file.file.seek(0)
        image = Image.open(file.file)
        exif_data = image.info.get("exif")
        date_taken = None
        # Extract date_taken for all formats
        if file.filename.lower().endswith((".heic", ".heif")):
            # Try exifread first
            try:
                file.file.seek(0)
                import exifread
                tags = exifread.process_file(file.file, details=False)
                date_taken = tags.get("EXIF DateTimeOriginal") or tags.get("Image DateTime")
                if date_taken:
                    date_taken = str(date_taken)
                else:
                    print(f"[DEBUG] exifread tags for {file.filename}: {list(tags.keys())}")
            except Exception as e:
                print(f"[DEBUG] exifread error for {file.filename}: {e}")
            # Fallback: piexif
            if not date_taken:
                try:
                    file.file.seek(0)
                    image = Image.open(file.file)
                    if image.info and "exif" in image.info:
                        import piexif
                        exif_dict = piexif.load(image.info["exif"])
                        date_taken = exif_dict['Exif'].get(36867) or exif_dict['0th'].get(306)
                        if date_taken and isinstance(date_taken, bytes):
                            date_taken = date_taken.decode(errors='ignore')
                        if not date_taken:
                            print(f"[DEBUG] piexif tags for {file.filename}: {exif_dict}")
                except Exception as e:
                    print(f"[DEBUG] piexif error for {file.filename}: {e}")
            print(f"\nFile: {file.filename}")
            print(f"  Date/Time Original: {date_taken if date_taken else 'Not found'}")
            # Convert to JPEG
            rgb_image = image.convert("RGB")
            jpeg_filename = os.path.splitext(file.filename)[0] + ".jpeg"
            jpeg_path = os.path.join(UPLOAD_DIR, jpeg_filename)
            os.makedirs(os.path.dirname(jpeg_path), exist_ok=True)  # Ensure subdirectories exist
            rgb_image.save(jpeg_path, "JPEG")
            saved_files.append(jpeg_filename)
            save_metadata(jpeg_filename, date_taken, ranking=1)
        else:
            # JPEG/TIFF: use piexif
            if exif_data and isinstance(exif_data, bytes):
                try:
                    file.file.seek(0)
                    import piexif
                    exif_dict = piexif.load(exif_data)
                    date_taken = exif_dict['Exif'].get(36867) or exif_dict['0th'].get(306)
                    if date_taken and isinstance(date_taken, bytes):
                        date_taken = date_taken.decode(errors='ignore')
                    if not date_taken:
                        print(f"[DEBUG] piexif tags for {file.filename}: {exif_dict}")
                except Exception as e:
                    print(f"[DEBUG] piexif error for {file.filename}: {e}")
            print(f"\nFile: {file.filename}")
            print(f"  Date/Time Original: {date_taken if date_taken else 'Not found'}")
            # Save original file
            file_path = os.path.join(UPLOAD_DIR, file.filename)
            os.makedirs(os.path.dirname(file_path), exist_ok=True)  # Ensure subdirectories exist
            file.file.seek(0)  # Reset pointer before reading
            with open(file_path, "wb") as f_out:
                content = await file.read()
                f_out.write(content)
            saved_files.append(file.filename)
            save_metadata(file.filename, date_taken, ranking=1)

    return JSONResponse(content={"uploaded": saved_files})


@app.get("/list_uploads")
def list_uploads():
    file_list = []
    for root, dirs, files in os.walk(UPLOAD_DIR):
        for f in files:
            rel_dir = os.path.relpath(root, UPLOAD_DIR)
            rel_file = os.path.join(rel_dir, f) if rel_dir != '.' else f
            file_list.append(rel_file)
    return {"files": file_list}


@app.get("/grouped_photos")
def grouped_photos():
    # Load metadata
    if not os.path.exists(METADATA_FILE):
        return {"groups": []}
    with open(METADATA_FILE, "r") as f:
        metadata = json.load(f)
    # Prepare list of (filename, date_taken) tuples, skip if date_taken is None
    photos = []
    for fname, meta in metadata.items():
        dt = meta.get("date_taken")
        if dt:
            try:
                dt_obj = datetime.strptime(dt, "%Y:%m:%d %H:%M:%S")
                photos.append((fname, dt_obj))
            except Exception:
                continue
    # Sort by date_taken
    photos.sort(key=lambda x: x[1])
    # Group photos within 10 seconds
    groups = []
    current_group = []
    for i, (fname, dt) in enumerate(photos):
        if not current_group:
            current_group.append((fname, dt))
        else:
            prev_dt = current_group[-1][1]
            if (dt - prev_dt).total_seconds() <= 10:
                current_group.append((fname, dt))
            else:
                groups.append([{'filename': f, 'date_taken': d.strftime('%Y:%m:%d %H:%M:%S')} for f, d in current_group])
                current_group = [(fname, dt)]
    if current_group:
        groups.append([{'filename': f, 'date_taken': d.strftime('%Y:%m:%d %H:%M:%S')} for f, d in current_group])
    return {"groups": groups}


@app.delete("/delete_upload")
def delete_upload(request: Request):
    data = request.query_params
    filename = data.get("filename")
    if not filename:
        raise HTTPException(status_code=400, detail="Filename required")
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    # Delete the file
    os.remove(file_path)
    # Remove from metadata.json
    if os.path.exists(METADATA_FILE):
        with open(METADATA_FILE, "r") as f:
            metadata = json.load(f)
        if filename in metadata:
            del metadata[filename]
            with open(METADATA_FILE, "w") as f:
                json.dump(metadata, f)
    # Clean up group names for empty groups
    cleanup_empty_group_names()
    return {"deleted": filename}


@app.post("/update_ranking")
def update_ranking(data: dict = Body(...)):
    filename = data.get("filename")
    ranking = data.get("ranking")
    if filename is None or ranking not in [0, 1, 2]:
        raise HTTPException(status_code=400, detail="Invalid filename or ranking")
    if not os.path.exists(METADATA_FILE):
        raise HTTPException(status_code=404, detail="Metadata file not found")
    with open(METADATA_FILE, "r") as f:
        metadata = json.load(f)
    if filename not in metadata:
        raise HTTPException(status_code=404, detail="File not found in metadata")
    metadata[filename]["ranking"] = ranking
    with open(METADATA_FILE, "w") as f:
        json.dump(metadata, f)
    return {"filename": filename, "ranking": ranking}


# # Open the image file
# image_path = "path/to/your/image.jpg"
# with Image.open(image_path) as img:
#     # Read the EXIF data
#     exif_data = img.info.get("exif")

#     # Perform any desired image processing or manipulation here
#     # For example, let's resize the image
#     new_size = (800, 600)
#     img = img.resize(new_size)

#     # Save the modified image with the original EXIF data
#     output_path = "path/to/output/image.jpg"
#     img.save(output_path, "JPEG", exif=exif_data)

GROUP_NAMES_FILE = os.path.join(UPLOAD_DIR, "group_names.json")

def cleanup_empty_group_names():
    # Load metadata
    if not os.path.exists(METADATA_FILE):
        groups = []
    else:
        with open(METADATA_FILE, "r") as f:
            metadata = json.load(f)
        # Prepare list of (filename, date_taken) tuples, skip if date_taken is None
        photos = []
        for fname, meta in metadata.items():
            dt = meta.get("date_taken")
            if dt:
                try:
                    dt_obj = datetime.strptime(dt, "%Y:%m:%d %H:%M:%S")
                    photos.append((fname, dt_obj))
                except Exception:
                    continue
        # Sort by date_taken
        photos.sort(key=lambda x: x[1])
        # Group photos within 10 seconds
        groups = []
        current_group = []
        for i, (fname, dt) in enumerate(photos):
            if not current_group:
                current_group.append((fname, dt))
            else:
                prev_dt = current_group[-1][1]
                if (dt - prev_dt).total_seconds() <= 10:
                    current_group.append((fname, dt))
                else:
                    groups.append(current_group)
                    current_group = [(fname, dt)]
        if current_group:
            groups.append(current_group)
    # Now, clean up group_names.json
    if os.path.exists(GROUP_NAMES_FILE):
        with open(GROUP_NAMES_FILE, "r") as f:
            group_names = json.load(f)
        # Only keep names for groups that still exist
        new_group_names = {}
        for idx in range(len(groups)):
            if str(idx) in group_names:
                new_group_names[str(idx)] = group_names[str(idx)]
        if new_group_names != group_names:
            with open(GROUP_NAMES_FILE, "w") as f:
                json.dump(new_group_names, f)

@app.get("/group_names")
def get_group_names():
    if not os.path.exists(GROUP_NAMES_FILE):
        return {}
    with open(GROUP_NAMES_FILE, "r") as f:
        return json.load(f)

@app.post("/set_group_name")
def set_group_name(data: dict = Body(...)):
    group_idx = data.get("group_idx")
    name = data.get("name")
    if group_idx is None or not isinstance(group_idx, int) or not isinstance(name, str):
        raise HTTPException(status_code=400, detail="Invalid group index or name")
    if os.path.exists(GROUP_NAMES_FILE):
        with open(GROUP_NAMES_FILE, "r") as f:
            group_names = json.load(f)
    else:
        group_names = {}
    group_names[str(group_idx)] = name
    with open(GROUP_NAMES_FILE, "w") as f:
        json.dump(group_names, f)
    return {"group_idx": group_idx, "name": name}