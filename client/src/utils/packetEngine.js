// Hash-based CRC32/Adler integrity simulator
export function calculateChecksum(str) {
  let a = 1, b = 0;
  const MOD = 65521;
  for (let i = 0; i < str.length; i++) {
    a = (a + str.charCodeAt(i)) % MOD;
    b = (b + a) % MOD;
  }
  return '0x' + ((b << 16) | a).toString(16).toUpperCase().padStart(8, '0');
}

// Convert string/binary into clean Wireshark Hex/ASCII presentation
export function generateHexDump(inputStr, maxLen = 128) {
  const truncated = inputStr.substring(0, maxLen);
  let hexLines = [];
  
  for (let i = 0; i < truncated.length; i += 16) {
    const chunk = truncated.slice(i, i + 16);
    const offset = i.toString(16).padStart(4, '0').toUpperCase();
    
    let hexPart = '';
    let asciiPart = '';
    
    for (let j = 0; j < chunk.length; j++) {
      const code = chunk.charCodeAt(j);
      hexPart += code.toString(16).padStart(2, '0').toUpperCase() + ' ';
      asciiPart += (code >= 32 && code <= 126) ? chunk[j] : '.';
    }
    
    hexPart = hexPart.padEnd(48, ' ');
    hexLines.push(`${offset}  ${hexPart} |${asciiPart}|`);
  }
  
  return hexLines.join('\n');
}

let packetSequenceNumber = 1001;

export function buildNetworkPacket({ srcUser, destIp = "192.168.1.255", type = "CHAT_DATA", rawPayload = "" }) {
  packetSequenceNumber += 1;
  const payloadStr = typeof rawPayload === 'object' ? JSON.stringify(rawPayload) : String(rawPayload);
  const checksum = calculateChecksum(payloadStr);

  return {
    frameNumber: packetSequenceNumber,
    timestamp: new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      hourCycle: 'h23'
    }).format(new Date()),
    layer2: {
      frameName: "Ethernet II",
      srcMAC: srcUser.mac || "02:00:5E:00:00:01",
      destMAC: "FF:FF:FF:FF:FF:FF",
      ethertype: "0x0800 (IPv4)"
    },
    layer3: {
      protocolName: "Internet Protocol Version 4",
      version: 4,
      headerLength: "20 bytes",
      tos: "0x00 (Routine)",
      totalLength: 20 + 20 + payloadStr.length,
      ttl: 64,
      protocol: "6 (TCP)",
      srcIP: srcUser.ip || "192.168.1.10",
      destIP: destIp,
      headerChecksum: "0x" + Math.floor(Math.random() * 65535).toString(16).padStart(4, '0').toUpperCase()
    },
    layer4: {
      protocolName: "Transmission Control Protocol (TCP)",
      srcPort: 49152 + (packetSequenceNumber % 1000),
      destPort: 5000,
      seq: packetSequenceNumber * 1460,
      ack: (packetSequenceNumber * 1460) + payloadStr.length,
      flags: {
        SYN: 0,
        ACK: 1,
        PSH: 1,
        FIN: 0
      },
      windowSize: 64240,
      checksum: checksum.slice(0, 6)
    },
    layer7: {
      protocolName: type === 'FILE_CHUNK' ? "NET-FILE-TRANSFER / STREAM" : "NET-CHAT / APPLICATION DATA",
      type,
      length: payloadStr.length,
      payloadSample: payloadStr.substring(0, 100),
      hexDump: generateHexDump(payloadStr, 96),
      integrityHash: checksum
    }
  };
}