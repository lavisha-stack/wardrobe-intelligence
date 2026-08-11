from rembg import remove
from PIL import Image
import cv2
import numpy as np
import os


# --------------------------------------------------
# FILES
# --------------------------------------------------

input_path = r"C:\Users\jay39\Downloads\test_skirt.jpeg"

cutout_path = r"C:\Users\jay39\Downloads\test_skirt_cutout.png"

final_path = r"C:\Users\jay39\Downloads\test_skirt_normalized.png"


# --------------------------------------------------
# 1. REMOVE BACKGROUND
# --------------------------------------------------

print("Opening image...")

input_image = Image.open(input_path).convert("RGBA")

print("Removing background...")

cutout = remove(input_image)

cutout.save(cutout_path)

print("Background removed successfully!")


# --------------------------------------------------
# 2. GET THE CLOTHING OBJECT
# --------------------------------------------------

print("Detecting clothing shape...")

rgba = np.array(cutout)

alpha = rgba[:, :, 3]

# Anything with meaningful transparency becomes
# background. The clothing itself becomes white.
mask = np.where(alpha > 20, 255, 0).astype(np.uint8)


# --------------------------------------------------
# 3. FIND CLOTHING BOUNDING BOX
# --------------------------------------------------

coords = cv2.findNonZero(mask)

if coords is None:
    raise RuntimeError("Could not detect the clothing object.")

x, y, w, h = cv2.boundingRect(coords)

print(f"Detected object:")
print(f"  x = {x}")
print(f"  y = {y}")
print(f"  width = {w}")
print(f"  height = {h}")


# --------------------------------------------------
# 4. CROP TRANSPARENT SPACE
# --------------------------------------------------

padding = 20

x1 = max(0, x - padding)
y1 = max(0, y - padding)
x2 = min(rgba.shape[1], x + w + padding)
y2 = min(rgba.shape[0], y + h + padding)

cropped = cutout.crop((x1, y1, x2, y2))


# --------------------------------------------------
# 5. ORIENTATION ANALYSIS
# --------------------------------------------------

print("Analysing orientation...")

cropped_rgba = np.array(cropped)

cropped_alpha = cropped_rgba[:, :, 3]

cropped_mask = np.where(
    cropped_alpha > 20,
    255,
    0
).astype(np.uint8)


# Find the main contour
contours, _ = cv2.findContours(
    cropped_mask,
    cv2.RETR_EXTERNAL,
    cv2.CHAIN_APPROX_SIMPLE
)

if not contours:
    raise RuntimeError(
        "Could not find clothing contour."
    )

largest_contour = max(
    contours,
    key=cv2.contourArea
)


# --------------------------------------------------
# 6. USE PCA TO ESTIMATE MAIN AXIS
# --------------------------------------------------

points = largest_contour.reshape(-1, 2).astype(
    np.float32
)

mean, eigenvectors, eigenvalues = cv2.PCACompute2(
    points,
    mean=None
)

main_axis = eigenvectors[0]

angle = np.degrees(
    np.arctan2(
        main_axis[1],
        main_axis[0]
    )
)

print(
    f"Detected main axis angle: {angle:.1f}°"
)


# --------------------------------------------------
# 7. NORMALIZE ANGLE
# --------------------------------------------------

# Convert the angle into a range of 0–180.
normalized_angle = angle % 180

print(
    f"Normalized angle: "
    f"{normalized_angle:.1f}°"
)


# --------------------------------------------------
# 8. CHOOSE ROTATION
# --------------------------------------------------

# This is intentionally conservative.
#
# If the main axis is close to horizontal,
# rotate the item approximately 90 degrees.
#
# If it is already mostly vertical,
# leave it alone.

if 30 <= normalized_angle <= 150:

    # Determine whether the object is closer
    # to horizontal or vertical.

    if 30 <= normalized_angle < 60:
        rotation = 90

    elif 120 < normalized_angle <= 150:
        rotation = 90

    else:
        rotation = 0

else:
    rotation = 0


print(
    f"Selected rotation: {rotation}°"
)


# --------------------------------------------------
# 9. ROTATE
# --------------------------------------------------

if rotation == 90:

    final_image = cropped.rotate(
        90,
        expand=True,
        resample=Image.Resampling.BICUBIC
    )

elif rotation == 180:

    final_image = cropped.rotate(
        180,
        expand=True,
        resample=Image.Resampling.BICUBIC
    )

elif rotation == 270:

    final_image = cropped.rotate(
        270,
        expand=True,
        resample=Image.Resampling.BICUBIC
    )

else:

    final_image = cropped


# --------------------------------------------------
# 10. SAVE FINAL IMAGE
# --------------------------------------------------

final_image.save(
    final_path,
    format="PNG"
)

print()
print("====================================")
print("NORMALIZATION COMPLETE")
print("====================================")
print()
print(f"Cutout:")
print(cutout_path)
print()
print(f"Normalized:")
print(final_path)
print()
print(f"Rotation applied: {rotation}°")
print()


# --------------------------------------------------
# 11. OPEN FINAL IMAGE
# --------------------------------------------------

os.startfile(final_path)