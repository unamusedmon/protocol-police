import os
import json
import re
import ipaddress
import random

src_dir = "/mnt/data/zeek-spool/zeek/"
files_to_process = [
    "conn.log",
    "weird.log",
    "ssl.log",
    "ssh.2026-05-04-02-00-00.log",
    "weird.2026-05-04-02-00-00.log",
    "ssl.2026-05-04-02-00-00.log"
]

dest_raw_dir = "/home/zach/protocol-police/src/data/zeek-scenarios/raw/"
dest_scen_dir = "/home/zach/protocol-police/src/data/zeek-scenarios/"

os.makedirs(dest_raw_dir, exist_ok=True)

ip_map = {
    "192.168.0.254": "10.0.0.1",
    "192.168.0.3": "10.0.0.10",
    "192.168.0.103": "10.0.0.20",
}

next_priv_ip = 21
next_pub_ip_idx = 0
pub_pools = [
    list(ipaddress.IPv4Network("192.0.2.0/24").hosts())[10:], # reserving 10 for github
    list(ipaddress.IPv4Network("198.51.100.0/24").hosts()),
    list(ipaddress.IPv4Network("203.0.113.0/24").hosts())
]
pub_pool_flat = [str(ip) for pool in pub_pools for ip in pool]

def is_private(ip_str):
    try:
        ip = ipaddress.ip_address(ip_str)
        return ip.is_private or ip.is_link_local or ip.is_multicast or ip.is_loopback
    except:
        return False

def get_sanitized_ip(ip_str):
    if ip_str in ip_map:
        return ip_map[ip_str]
    
    try:
        ip = ipaddress.ip_address(ip_str)
    except:
        return ip_str

    if isinstance(ip, ipaddress.IPv4Address) and str(ip).startswith("140.82."):
        ip_map[ip_str] = "192.0.2.10"
        return "192.0.2.10"

    if is_private(ip_str):
        global next_priv_ip
        new_ip = f"10.0.0.{next_priv_ip}"
        next_priv_ip += 1
        ip_map[ip_str] = new_ip
        return new_ip
    else:
        global next_pub_ip_idx
        if next_pub_ip_idx < len(pub_pool_flat):
            new_ip = pub_pool_flat[next_pub_ip_idx]
            next_pub_ip_idx += 1
        else:
            new_ip = f"198.51.100.{random.randint(1, 254)}" # fallback
        ip_map[ip_str] = new_ip
        return new_ip

sanitized_logs = {}

for fname in files_to_process:
    src_path = os.path.join(src_dir, fname)
    if not os.path.exists(src_path):
        continue
    
    with open(src_path, 'r') as f:
        lines = f.readlines()
        
    sanitized_lines = []
    sanitized_objs = []
    for line in lines:
        try:
            obj = json.loads(line)
            for key in ["id.orig_h", "id.resp_h"]:
                if key in obj:
                    obj[key] = get_sanitized_ip(obj[key])
            sanitized_lines.append(json.dumps(obj))
            sanitized_objs.append(obj)
        except json.JSONDecodeError:
            pass
            
    sanitized_logs[fname] = sanitized_objs
    
    dest_path = os.path.join(dest_raw_dir, fname)
    with open(dest_path, 'w') as f:
        f.write('\n'.join(sanitized_lines) + '\n')

def create_scenario_1():
    conn_logs = sanitized_logs.get("conn.log", [])
    weird_logs = sanitized_logs.get("weird.log", [])
    
    excerpt = []
    dns_logs = [l for l in conn_logs if l.get("service") == "dns"][:5]
    https_logs = [l for l in conn_logs if l.get("id.resp_p") == 443][:5]
    oth_logs = [l for l in conn_logs if l.get("conn_state") == "OTH"][:5]
    shr_logs = [l for l in conn_logs if l.get("conn_state") == "SHR"][:5]
    reuse_logs = [l for l in weird_logs if l.get("name") == "active_connection_reuse"][:5]
    
    excerpt.extend(dns_logs)
    excerpt.extend(https_logs)
    excerpt.extend(oth_logs)
    excerpt.extend(shr_logs)
    excerpt.extend(reuse_logs)
    
    scen = {
      "id": "scenario-001",
      "title": "Baseline Lab: Steady State Anomalies",
      "difficulty": "baseline",
      "protocol_tags": ["tcp", "dns", "ip"],
      "rfc_refs": ["RFC 9293", "RFC 791"],
      "log_types": ["conn", "weird"],
      "narrative": "A week of normal home network traffic. Students must differentiate between normal NAT behavior, asymmetric routing ghost states, and actual anomalies.",
      "log_excerpt": excerpt,
      "questions": [
        {
          "question": "What does a conn_state of 'OTH' mean in these logs?",
          "answer": "OTH indicates no SYN was seen.",
          "hint": "Check the Zeek documentation for 'OTH'.",
          "rfc_section": "RFC 9293 - TCP Connection State Machine"
        },
        {
          "question": "Why are there so many 'active_connection_reuse' notices from the gateway?",
          "answer": "The NAT gateway is rapidly reusing ephemeral source ports. Because the sensor might miss FIN/RST packets due to drops or asymmetric routing, it sees a new SYN for an existing connection 4-tuple.",
          "hint": "Look at the source IP for these notices. Is it a single host or a NAT gateway?",
          "rfc_section": "RFC 9293 - Connection Reuse"
        }
      ],
      "threat_hunting_notes": "When analyzing NAT gateways, frequent connection reuse combined with missed teardown packets creates 'ghost' states."
    }
    with open(os.path.join(dest_scen_dir, "scenario-001-baseline.json"), 'w') as f:
        json.dump(scen, f, indent=2)

def create_scenario_2():
    ssh_logs = sanitized_logs.get("ssh.2026-05-04-02-00-00.log", [])
    conn_logs = sanitized_logs.get("conn.log", [])
    
    excerpt = []
    github_ssh = [l for l in ssh_logs if l.get("id.resp_h") == "192.0.2.10"]
    github_conn = [l for l in conn_logs if l.get("id.resp_h") == "192.0.2.10"]
    
    excerpt.extend(github_ssh)
    excerpt.extend(github_conn)
    
    scen = {
      "id": "scenario-002",
      "title": "The GitHub Ghost",
      "difficulty": "intermediate",
      "protocol_tags": ["tcp", "ssh"],
      "rfc_refs": ["RFC 4253"],
      "log_types": ["ssh", "conn"],
      "narrative": "Connections are being made to a known code hosting service over SSH, but the authentication attempts consistently show 0.",
      "log_excerpt": excerpt,
      "questions": [
        {
          "question": "Why does auth_attempts show 0 for these SSH connections?",
          "answer": "Zero auth attempts in Zeek usually means public-key authentication succeeded immediately without interactive retries or password prompts.",
          "hint": "Think about automated scripts using SSH keys.",
          "rfc_section": "RFC 4252 - SSH Authentication Protocol"
        }
      ],
      "threat_hunting_notes": "Automated services will often authenticate seamlessly with keys, producing 0 auth attempts. This is normal for service accounts but should be correlated with known automation schedules."
    }
    with open(os.path.join(dest_scen_dir, "scenario-002-github-ghost.json"), 'w') as f:
        json.dump(scen, f, indent=2)

def create_scenario_3():
    weird_logs = sanitized_logs.get("weird.2026-05-04-02-00-00.log", [])
    conn_logs = sanitized_logs.get("conn.log", [])
    
    excerpt = []
    oth_logs = [l for l in conn_logs if l.get("conn_state") == "OTH"][:10]
    reuse_logs = [l for l in weird_logs if l.get("name") == "active_connection_reuse"][:10]
    
    excerpt.extend(oth_logs)
    excerpt.extend(reuse_logs)
    
    scen = {
      "id": "scenario-003",
      "title": "OTH in the Wire",
      "difficulty": "advanced",
      "protocol_tags": ["tcp"],
      "rfc_refs": ["RFC 9293"],
      "log_types": ["conn", "weird"],
      "narrative": "A flood of connections appear without a SYN, forcing the sensor into 'OTH' states and triggering massive 'active_connection_reuse' notices. The learner must deduce the cause of the missing TCP handshakes.",
      "log_excerpt": excerpt,
      "questions": [
        {
          "question": "What network condition causes a passive sensor to see OTH connections from a NAT gateway?",
          "answer": "Asymmetric routing or packet drops by the sensor itself.",
          "hint": "If a sensor is placed on a link that only handles outbound traffic...",
          "rfc_section": "RFC 9293 - TCP Connection State Machine"
        }
      ],
      "threat_hunting_notes": "When weird.log spikes with connection_reuse and conn.log floods with OTH, check your sensor placement and capture drops before assuming a malicious network scan."
    }
    with open(os.path.join(dest_scen_dir, "scenario-003-tcp-state-machine.json"), 'w') as f:
        json.dump(scen, f, indent=2)

create_scenario_1()
create_scenario_2()
create_scenario_3()

print(json.dumps(ip_map, indent=2))
