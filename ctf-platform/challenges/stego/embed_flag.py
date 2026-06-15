import sys
from PIL import Image, ImageDraw

FLAG = sys.argv[1]


def create_base_image():
    img = Image.new('RGB', (800, 500), color=(15, 23, 42))
    draw = ImageDraw.Draw(img)

    # Header
    draw.rectangle([0, 0, 800, 75], fill=(30, 41, 59))
    draw.rectangle([0, 75, 800, 78], fill=(99, 102, 241))
    draw.text((28, 22), "DTIC  —  Universidad San Francisco Xavier de Chuquisaca", fill=(226, 232, 240))
    draw.text((28, 50), "Sistema de Gestión Documental  ·  CONFIDENCIAL", fill=(148, 163, 184))

    # Content card
    draw.rectangle([28, 105, 772, 390], fill=(30, 41, 59))
    draw.rectangle([28, 105, 772, 107], fill=(99, 102, 241))

    fields = [
        ("Proyecto",        "AURORA-7",                          (167, 243, 208)),
        ("Fecha",           "2026-05-20",                        (203, 213, 225)),
        ("Clasificacion",   "RESTRINGIDO",                       (252, 165, 165)),
        ("Responsable",     "Dir. Tecnologias de Informacion",   (203, 213, 225)),
        ("Estado",          "PENDIENTE DE FIRMA DIGITAL",        (251, 191, 36)),
        ("Contenido",       "Informe de auditoria de seguridad Q1-2026", (148, 163, 184)),
        ("Ref. Interna",    "DTIC-2026-0517-SEC",                (203, 213, 225)),
    ]

    y = 125
    for label, value, color in fields:
        draw.text((48, y), f"{label}:", fill=(100, 116, 139))
        draw.text((200, y), value, fill=color)
        y += 32

    # Footer
    draw.rectangle([0, 460, 800, 500], fill=(30, 41, 59))
    draw.text((28, 473), "DTIC-USFX © 2026  —  Documento de uso interno exclusivo", fill=(71, 85, 105))

    return img


def embed_lsb(img, message):
    pixels = img.load()
    width, height = img.size
    data = (message + '\x00').encode()
    bits = ''.join(f'{b:08b}' for b in data)

    if len(bits) > width * height:
        raise ValueError(f"Mensaje demasiado largo ({len(bits)} bits > {width*height} píxeles)")

    idx = 0
    for y in range(height):
        for x in range(width):
            if idx >= len(bits):
                return img
            r, g, b = pixels[x, y]
            r = (r & 0xFE) | int(bits[idx])
            pixels[x, y] = (r, g, b)
            idx += 1
    return img


img = create_base_image()
img = embed_lsb(img, FLAG)
img.save('/app/static/documento_aurora7.png')
print(f"Flag embebida en LSB del canal rojo ({len(FLAG)} chars).")
