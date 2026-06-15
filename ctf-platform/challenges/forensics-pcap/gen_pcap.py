import struct
import sys

FLAG = sys.argv[1]


def pcap_global_header():
    return struct.pack('<IHHiIII', 0xa1b2c3d4, 2, 4, 0, 0, 65535, 1)


def pcap_record(ts_us, data):
    ts_sec = ts_us // 1_000_000
    ts_usec = ts_us % 1_000_000
    return struct.pack('<IIII', ts_sec, ts_usec, len(data), len(data)) + data


def make_packet(src_mac, dst_mac, src_ip, dst_ip, src_port, dst_port,
                seq, ack_num, flags, payload=b''):
    eth = bytes.fromhex(src_mac) + bytes.fromhex(dst_mac) + b'\x08\x00'

    tcp = struct.pack('>HHIIBBHHH',
        src_port, dst_port,
        seq, ack_num,
        0x50, flags,
        65535, 0, 0,
    ) + payload

    ip_len = 20 + len(tcp)
    ip = struct.pack('>BBHHHBBH4s4s',
        0x45, 0, ip_len,
        0x1337, 0x4000,
        128, 6, 0,
        bytes(map(int, src_ip.split('.'))),
        bytes(map(int, dst_ip.split('.'))),
    )

    return eth + ip + tcp


CLIENT_IP  = '192.168.1.105'
SERVER_IP  = '192.168.1.1'
CLIENT_MAC = 'aabbccddeeff'
SERVER_MAC = '001122334455'
CLIENT_PORT = 54321
FTP_PORT    = 21

SYN    = 0x02
ACK    = 0x10
SYNACK = SYN | ACK
PSHACK = 0x08 | ACK
FINACK = 0x01 | ACK

# 2026-05-20 10:00:00 UTC
BASE_TS = 1747735200 * 1_000_000

pkts = []


def pkt(ms, s_ip, d_ip, s_port, d_port, seq, ack, flags, payload=b''):
    s_mac = CLIENT_MAC if s_ip == CLIENT_IP else SERVER_MAC
    d_mac = SERVER_MAC if s_ip == CLIENT_IP else CLIENT_MAC
    raw = make_packet(s_mac, d_mac, s_ip, d_ip, s_port, d_port, seq, ack, flags, payload)
    pkts.append((BASE_TS + ms * 1000, raw))


# ── TCP handshake ────────────────────────────────────────────────────────────
pkt(0,   CLIENT_IP, SERVER_IP, CLIENT_PORT, FTP_PORT, 1000, 0,    SYN)
pkt(8,   SERVER_IP, CLIENT_IP, FTP_PORT, CLIENT_PORT, 5000, 1001, SYNACK)
pkt(16,  CLIENT_IP, SERVER_IP, CLIENT_PORT, FTP_PORT, 1001, 5001, ACK)

# ── FTP session ──────────────────────────────────────────────────────────────
banner = b'220 DTIC-FTP v2.1 Ready. Acceso solo para personal autorizado.\r\n'
pkt(30,  SERVER_IP, CLIENT_IP, FTP_PORT, CLIENT_PORT, 5001, 1001, PSHACK, banner)
pkt(38,  CLIENT_IP, SERVER_IP, CLIENT_PORT, FTP_PORT, 1001, 5001 + len(banner), ACK)

user = b'USER administrador\r\n'
pkt(120, CLIENT_IP, SERVER_IP, CLIENT_PORT, FTP_PORT, 1001, 5001 + len(banner), PSHACK, user)
pkt(128, SERVER_IP, CLIENT_IP, FTP_PORT, CLIENT_PORT, 5001 + len(banner), 1001 + len(user), ACK)

prompt = b'331 Contrasena requerida para administrador\r\n'
pkt(140, SERVER_IP, CLIENT_IP, FTP_PORT, CLIENT_PORT, 5001 + len(banner), 1001 + len(user), PSHACK, prompt)
pkt(148, CLIENT_IP, SERVER_IP, CLIENT_PORT, FTP_PORT, 1001 + len(user), 5001 + len(banner) + len(prompt), ACK)

srv_seq1 = 5001 + len(banner) + len(prompt)
cli_seq1 = 1001 + len(user)

passwd = f'PASS {FLAG}\r\n'.encode()
pkt(240, CLIENT_IP, SERVER_IP, CLIENT_PORT, FTP_PORT, cli_seq1, srv_seq1, PSHACK, passwd)
pkt(248, SERVER_IP, CLIENT_IP, FTP_PORT, CLIENT_PORT, srv_seq1, cli_seq1 + len(passwd), ACK)

ok = b'230 Inicio de sesion exitoso.\r\n'
pkt(260, SERVER_IP, CLIENT_IP, FTP_PORT, CLIENT_PORT, srv_seq1, cli_seq1 + len(passwd), PSHACK, ok)
pkt(268, CLIENT_IP, SERVER_IP, CLIENT_PORT, FTP_PORT, cli_seq1 + len(passwd), srv_seq1 + len(ok), ACK)

srv_seq2 = srv_seq1 + len(ok)
cli_seq2 = cli_seq1 + len(passwd)

quit_cmd = b'QUIT\r\n'
pkt(500, CLIENT_IP, SERVER_IP, CLIENT_PORT, FTP_PORT, cli_seq2, srv_seq2, PSHACK, quit_cmd)

bye = b'221 Hasta luego.\r\n'
pkt(510, SERVER_IP, CLIENT_IP, FTP_PORT, CLIENT_PORT, srv_seq2, cli_seq2 + len(quit_cmd), PSHACK, bye)

# ── Write file ───────────────────────────────────────────────────────────────
with open('/app/static/captura_red.pcap', 'wb') as f:
    f.write(pcap_global_header())
    for ts, data in pkts:
        f.write(pcap_record(ts, data))

print(f"PCAP generado: {len(pkts)} paquetes, flag en comando PASS.")
