import os
import webbrowser

def main():
    # Paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    template_path = os.path.join(base_dir, "templates", "base.html")
    css_path = os.path.join(base_dir, "static", "css", "style.css")
    js_path = os.path.join(base_dir, "static", "js", "app.js")

    print(f"[AVIVA] Reading resources from: {base_dir}")

    # Read Resources
    try:
        with open(template_path, "r", encoding="utf-8") as f:
            html = f.read()
        with open(css_path, "r", encoding="utf-8") as f:
            css = f.read()
        with open(js_path, "r", encoding="utf-8") as f:
            js = f.read()
            
        # Image
        img_path = os.path.join(base_dir, "static", "img", "logo.png")
        if os.path.exists(img_path):
            with open(img_path, "rb") as f:
                img_data = f.read()
                import base64
                b64_img = base64.b64encode(img_data).decode('utf-8')
                logo_src = f"data:image/png;base64,{b64_img}"
        else:
            print("[WARN] Logo not found, using text fallback.")
            logo_src = ""

    except FileNotFoundError as e:
        print(f"[ERROR] Could not find resource: {e}")
        return

    # Inject
    full_html = html.replace("{STYLE}", f"<style>\n{css}\n</style>")
    full_html = full_html.replace("{SCRIPT}", f"<script>\n{js}\n</script>")
    full_html = full_html.replace("{LOGO}", logo_src)

    # Output to parent directory (scratch root) so it's easily accessible
    # Assuming script is in /scratch/aviva_viz/aviva_viz.py
    # Output -> /scratch/aviva_dashboard.html
    # This matches the previous behavior where we ran 'python aviva_viz/aviva_viz.py' from scratch and outputted to abspath("aviva_dashboard.html")
    
    # Actually, previous script used os.path.abspath("aviva_dashboard.html").
    # If run from scratch, that creates it in scratch.
    # If run from aviva_viz/, it creates it in aviva_viz/.
    # To be consistent and safe, let's output it to the directory ABOVE the script directory, which is scratch.
    
    output_dir = os.path.dirname(base_dir) # ../ (scratch)
    output_path = os.path.join(output_dir, "aviva_dashboard.html")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(full_html)
    
    print(f"[AVIVA] Dashboard generated at: {output_path}")
    print("[AVIVA] Launching interface...")
    webbrowser.open(f"file://{output_path}")

if __name__ == "__main__":
    main()
