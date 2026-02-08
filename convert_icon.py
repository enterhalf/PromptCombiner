from PIL import Image
import os
import shutil

input_path = r"D:\_sync\Files\_Media\头像\观星傻.png"
output_dir = r"D:\PromptA\src-tauri\icons"

try:
    img = Image.open(input_path)
    
    if img.mode in ('P', 'PA'):
        img = img.convert('RGBA')
    elif img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    sizes = [32, 64, 128, 256, 512]
    
    ico_sizes = [(size, size) for size in sizes]
    ico_path = os.path.join(output_dir, "icon.ico")
    img.save(ico_path, format='ICO', sizes=ico_sizes)
    
    for size in sizes:
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        png_path = os.path.join(output_dir, f"{size}x{size}.png")
        resized.save(png_path, format='PNG')
    
    retina_256 = img.resize((256, 256), Image.Resampling.LANCZOS)
    retina_path = os.path.join(output_dir, "128x128@2x.png")
    retina_256.save(retina_path, format='PNG')
    
    icns_path = os.path.join(output_dir, "icon.icns")
    shutil.copy(input_path, icns_path)
    
    print(f"Successfully created icons in {output_dir}")
    print(f"- icon.ico (Windows)")
    print(f"- 32x32.png, 64x64.png, 128x128.png, 256x256.png, 512x512.png (Linux)")
    print(f"- 128x128@2x.png (Retina display)")
    print(f"- icon.icns (macOS)")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
