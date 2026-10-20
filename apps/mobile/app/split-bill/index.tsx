import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Share,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  Users,
  Percent,
  Receipt,
  Plus,
  Trash2,
  Share2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  CreditCard,
} from 'lucide-react-native';
import { formatRupiah, parseRupiah } from '@uangku/contracts';
import { colors } from '../../src/theme/colors';
import { hapticMedium, hapticSelection, hapticSuccess, hapticLight } from '../../src/theme/haptics';
import { useToast } from '../../src/components/Toast';

interface Participant {
  id: string;
  name: string;
  customSubtotal?: number;
}

type SplitMode = 'equal' | 'custom';

export default function SplitBillScreen() {
  const router = useRouter();
  const toast = useToast();

  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [subtotalInput, setSubtotalInput] = useState('150000');
  const [taxPercent, setTaxPercent] = useState<number | null>(11); // 11% PB1/PPN
  const [servicePercent, setServicePercent] = useState<number | null>(5); // 5% Service charge
  const [bankInfo, setBankInfo] = useState('BCA 12345678 a/n Gary');

  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', name: 'Saya' },
    { id: '2', name: 'Teman 1' },
    { id: '3', name: 'Teman 2' },
  ]);

  const subtotal = useMemo(() => parseRupiah(subtotalInput), [subtotalInput]);

  // Minor-Unit Integer Division Algorithm (PRD Section 69)
  const calculationResult = useMemo(() => {
    const taxAmount = taxPercent ? Math.round((subtotal * taxPercent) / 100) : 0;
    const serviceAmount = servicePercent ? Math.round((subtotal * servicePercent) / 100) : 0;
    const grandTotal = subtotal + taxAmount + serviceAmount;
    const n = Math.max(participants.length, 1);

    if (splitMode === 'equal') {
      const baseShare = Math.floor(grandTotal / n);
      const remainder = grandTotal - baseShare * n;

      const shares = participants.map((p, idx) => {
        // Distribute remainder minor-units to the first 'remainder' people
        const personShare = idx < remainder ? baseShare + 1 : baseShare;
        return {
          id: p.id,
          name: p.name,
          subtotalShare: Math.floor(subtotal / n),
          totalShare: personShare,
          hasRoundingAdjustment: idx < remainder && remainder > 0,
        };
      });

      return {
        subtotal,
        taxAmount,
        serviceAmount,
        grandTotal,
        shares,
        remainder,
      };
    } else {
      // Custom / Itemized Mode: Proportional tax & service distribution
      const sumCustom = participants.reduce((acc, p) => acc + (p.customSubtotal || 0), 0);
      const effectiveSubtotal = sumCustom > 0 ? sumCustom : subtotal;
      const extraFees = taxAmount + serviceAmount;

      let allocatedFeeSum = 0;
      const shares = participants.map((p) => {
        const pSub = p.customSubtotal || 0;
        const pFee = effectiveSubtotal > 0 ? Math.floor((pSub * extraFees) / effectiveSubtotal) : 0;
        allocatedFeeSum += pFee;
        return {
          id: p.id,
          name: p.name,
          subtotalShare: pSub,
          feeShare: pFee,
          totalShare: pSub + pFee,
          hasRoundingAdjustment: false,
        };
      });

      // Distribute fee remainder
      const feeRemainder = extraFees - allocatedFeeSum;
      for (let i = 0; i < feeRemainder; i++) {
        if (shares[i]) {
          shares[i].totalShare += 1;
          shares[i].hasRoundingAdjustment = true;
        }
      }

      const calculatedGrandTotal = shares.reduce((acc, s) => acc + s.totalShare, 0);

      return {
        subtotal: effectiveSubtotal,
        taxAmount,
        serviceAmount,
        grandTotal: calculatedGrandTotal,
        shares,
        remainder: feeRemainder,
      };
    }
  }, [subtotal, taxPercent, servicePercent, splitMode, participants]);

  const handleAddParticipant = () => {
    hapticLight();
    const nextNum = participants.length + 1;
    setParticipants((prev) => [
      ...prev,
      { id: String(Date.now()), name: `Teman ${nextNum}` },
    ]);
  };

  const handleRemoveParticipant = (id: string) => {
    if (participants.length <= 2) {
      toast.showWarning('Batas Minimal', 'Split bill membutuhkan minimal 2 orang.');
      return;
    }
    hapticLight();
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdateName = (id: string, name: string) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name } : p))
    );
  };

  const handleUpdateCustomSubtotal = (id: string, text: string) => {
    const val = parseRupiah(text);
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, customSubtotal: val } : p))
    );
  };

  const handleShareToWhatsApp = async () => {
    hapticMedium();
    const lines = [
      `🧾 *RINCIAN SPLIT BILL UANGKU*`,
      `Total Tagihan: ${formatRupiah(calculationResult.grandTotal)}`,
      `• Subtotal: ${formatRupiah(calculationResult.subtotal)}`,
    ];

    if (calculationResult.taxAmount > 0) {
      lines.push(`• Pajak (${taxPercent}%): ${formatRupiah(calculationResult.taxAmount)}`);
    }
    if (calculationResult.serviceAmount > 0) {
      lines.push(`• Servis (${servicePercent}%): ${formatRupiah(calculationResult.serviceAmount)}`);
    }

    lines.push(`\n*Pembagian per Orang (${participants.length} orang):*`);
    calculationResult.shares.forEach((s, idx) => {
      lines.push(`${idx + 1}. *${s.name}*: ${formatRupiah(s.totalShare)}`);
    });

    if (bankInfo.trim()) {
      lines.push(`\n💳 *Info Transfer:*\n${bankInfo.trim()}`);
    }

    lines.push(`\n_Dihitung akurat hingga Rp 1 dengan UangKu App._`);

    const message = lines.join('\n');

    try {
      await Share.share({
        message,
        title: 'Rincian Split Bill',
      });
      hapticSuccess();
    } catch (err: any) {
      Alert.alert('Gagal Membagikan', err.message);
    }
  };

  const handleRecordMyShare = () => {
    hapticMedium();
    const myShare = calculationResult.shares[0]?.totalShare || 0;
    if (myShare <= 0) {
      toast.showWarning('Nominal Kosong', 'Porsi Anda masih Rp 0.');
      return;
    }

    router.push({
      pathname: '/transaction/new',
      params: {
        presetAmount: String(myShare),
        presetNote: `Split Bill: ${participants.length} Orang`,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              hapticSelection();
              router.back();
            }}
          >
            <ChevronLeft size={22} color={colors.gold.champagne} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Kalkulator Split Bill</Text>
            <Text style={styles.headerSubtitle}>Presisi Minor-Unit (Rp 0 Selisih)</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.shareHeaderBtn}
          onPress={handleShareToWhatsApp}
        >
          <Share2 size={16} color={colors.gold.champagne} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Grand Total Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Receipt size={16} color={colors.gold.champagne} />
            <Text style={styles.heroLabel}>TOTAL AKHIR TAGIHAN</Text>
          </View>

          <Text style={styles.heroTotalValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatRupiah(calculationResult.grandTotal)}
          </Text>

          <View style={styles.heroBreakdownRow}>
            <Text style={styles.heroBreakdownItem}>
              Subtotal: {formatRupiah(calculationResult.subtotal)}
            </Text>
            {calculationResult.taxAmount > 0 && (
              <Text style={styles.heroBreakdownItem}>
                Pajak: +{formatRupiah(calculationResult.taxAmount)}
              </Text>
            )}
            {calculationResult.serviceAmount > 0 && (
              <Text style={styles.heroBreakdownItem}>
                Servis: +{formatRupiah(calculationResult.serviceAmount)}
              </Text>
            )}
          </View>
        </View>

        {/* Mode Switcher */}
        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.modeTab, splitMode === 'equal' && styles.modeTabActive]}
            onPress={() => {
              hapticSelection();
              setSplitMode('equal');
            }}
          >
            <Users size={14} color={splitMode === 'equal' ? '#090A0E' : colors.text.secondary} />
            <Text style={[styles.modeTabText, splitMode === 'equal' && styles.modeTabTextActive]}>
              Bagi Rata (Equal)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, splitMode === 'custom' && styles.modeTabActive]}
            onPress={() => {
              hapticSelection();
              setSplitMode('custom');
            }}
          >
            <Percent size={14} color={splitMode === 'custom' ? '#090A0E' : colors.text.secondary} />
            <Text style={[styles.modeTabText, splitMode === 'custom' && styles.modeTabTextActive]}>
              Porsi Itemized / Kustom
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bill Subtotal Input */}
        {splitMode === 'equal' && (
          <View style={styles.inputGroup}>
            <Text style={styles.groupLabel}>TOTAL TAGIHAN POKOK (SUBTOTAL)</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput
                style={styles.amountTextInput}
                keyboardType="numeric"
                value={subtotal > 0 ? subtotal.toLocaleString('id-ID') : ''}
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                onChangeText={(val) => {
                  const num = parseInt(val.replace(/\D/g, ''), 10);
                  setSubtotalInput(isNaN(num) ? '0' : String(num));
                }}
              />
            </View>

            {/* Preset Amount Chips */}
            <View style={styles.presetRow}>
              {[50000, 100000, 250000, 500000].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={styles.presetChip}
                  onPress={() => {
                    hapticSelection();
                    setSubtotalInput(String(preset));
                  }}
                >
                  <Text style={styles.presetChipText}>{formatRupiah(preset)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Tax & Service Toggles */}
        <View style={styles.feeSection}>
          <Text style={styles.groupLabel}>PAJAK & BIAYA LAYANAN</Text>
          <View style={styles.feeRow}>
            {/* Tax */}
            <View style={styles.feeCol}>
              <Text style={styles.feeColLabel}>Pajak Resto (PB1)</Text>
              <View style={styles.feeOptions}>
                {[0, 10, 11].map((pct) => {
                  const isSelected = (taxPercent || 0) === pct;
                  return (
                    <TouchableOpacity
                      key={pct}
                      style={[styles.feeOptionBtn, isSelected && styles.feeOptionBtnActive]}
                      onPress={() => {
                        hapticSelection();
                        setTaxPercent(pct === 0 ? null : pct);
                      }}
                    >
                      <Text
                        style={[
                          styles.feeOptionText,
                          isSelected && styles.feeOptionTextActive,
                        ]}
                      >
                        {pct === 0 ? '0%' : `${pct}%`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Service */}
            <View style={styles.feeCol}>
              <Text style={styles.feeColLabel}>Biaya Layanan</Text>
              <View style={styles.feeOptions}>
                {[0, 5, 7].map((pct) => {
                  const isSelected = (servicePercent || 0) === pct;
                  return (
                    <TouchableOpacity
                      key={pct}
                      style={[styles.feeOptionBtn, isSelected && styles.feeOptionBtnActive]}
                      onPress={() => {
                        hapticSelection();
                        setServicePercent(pct === 0 ? null : pct);
                      }}
                    >
                      <Text
                        style={[
                          styles.feeOptionText,
                          isSelected && styles.feeOptionTextActive,
                        ]}
                      >
                        {pct === 0 ? '0%' : `${pct}%`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* Participants Section */}
        <View style={styles.participantsSection}>
          <View style={styles.participantsHeader}>
            <View style={styles.pHeaderLeft}>
              <Text style={styles.groupLabel}>DAFTAR ORANG ({participants.length} TEMAN)</Text>
            </View>
            <TouchableOpacity
              style={styles.addParticipantBtn}
              onPress={handleAddParticipant}
            >
              <Plus size={12} color={colors.gold.champagne} />
              <Text style={styles.addParticipantText}>+ Tambah Teman</Text>
            </TouchableOpacity>
          </View>

          {calculationResult.shares.map((person, index) => {
            const isMe = index === 0;
            return (
              <View key={person.id} style={styles.personCard}>
                <View style={styles.personTopRow}>
                  <View style={styles.personLeft}>
                    <View
                      style={[
                        styles.personAvatar,
                        isMe && styles.personAvatarMe,
                      ]}
                    >
                      <Text style={[styles.avatarText, isMe && styles.avatarTextMe]}>
                        {index + 1}
                      </Text>
                    </View>
                    <TextInput
                      style={styles.personNameInput}
                      value={person.name}
                      onChangeText={(val) => handleUpdateName(person.id, val)}
                      placeholder="Nama teman"
                      placeholderTextColor={colors.text.muted}
                    />
                  </View>

                  <View style={styles.personRight}>
                    <Text style={styles.personShareAmount}>
                      {formatRupiah(person.totalShare)}
                    </Text>
                    {!isMe && (
                      <TouchableOpacity
                        style={styles.deletePersonBtn}
                        onPress={() => handleRemoveParticipant(person.id)}
                      >
                        <Trash2 size={13} color={colors.flow.expense} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* In Custom Mode: Allow direct input for their subtotal */}
                {splitMode === 'custom' && (
                  <View style={styles.customSubtotalRow}>
                    <Text style={styles.customSubtotalLabel}>Porsi Makanan:</Text>
                    <TextInput
                      style={styles.customSubtotalInput}
                      placeholder="0"
                      placeholderTextColor={colors.text.muted}
                      keyboardType="numeric"
                      value={
                        participants[index]?.customSubtotal
                          ? participants[index].customSubtotal!.toLocaleString('id-ID')
                          : ''
                      }
                      onChangeText={(val) => handleUpdateCustomSubtotal(person.id, val)}
                    />
                  </View>
                )}

                {person.hasRoundingAdjustment && (
                  <Text style={styles.roundingNote}>
                    * Termasuk pembulatan minor unit +Rp 1
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Bank & Payment Info */}
        <View style={styles.inputGroup}>
          <Text style={styles.groupLabel}>INFO REKENING PENERIMA (OPSIONAL)</Text>
          <View style={styles.bankInputRow}>
            <CreditCard size={16} color={colors.gold.champagne} />
            <TextInput
              style={styles.bankTextInput}
              placeholder="cth. BCA 12345678 a/n Gary"
              placeholderTextColor={colors.text.muted}
              value={bankInfo}
              onChangeText={setBankInfo}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.recordMyShareBtn}
            activeOpacity={0.8}
            onPress={handleRecordMyShare}
          >
            <View style={styles.btnContentRow}>
              <Sparkles size={16} color="#090A0E" />
              <Text style={styles.recordMyShareText}>
                Catat Porsi Saya ({formatRupiah(calculationResult.shares[0]?.totalShare || 0)})
              </Text>
            </View>
            <ArrowRight size={16} color="#090A0E" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareWhatsAppBtn}
            activeOpacity={0.8}
            onPress={handleShareToWhatsApp}
          >
            <Share2 size={16} color={colors.gold.champagne} />
            <Text style={styles.shareWhatsAppText}>Bagikan ke WhatsApp / Salin Rincian</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    backgroundColor: colors.bg.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.text.muted,
  },
  shareHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
    gap: 18,
  },
  heroCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    gap: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.gold.champagne,
  },
  heroTotalValue: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.8,
  },
  heroBreakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  heroBreakdownItem: {
    fontSize: 11,
    color: colors.text.muted,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.bg.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  modeTabActive: {
    backgroundColor: colors.gold.primary,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  modeTabTextActive: {
    color: '#090A0E',
    fontWeight: '700',
  },
  inputGroup: {
    gap: 6,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.text.muted,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gold.champagne,
    marginRight: 6,
  },
  amountTextInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    paddingVertical: 12,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  presetChipText: {
    fontSize: 11,
    color: colors.gold.champagne,
    fontWeight: '600',
  },
  feeSection: {
    gap: 8,
  },
  feeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  feeCol: {
    flex: 1,
    backgroundColor: colors.bg.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: 8,
  },
  feeColLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  feeOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  feeOptionBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  feeOptionBtnActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    borderColor: colors.gold.primary,
  },
  feeOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.muted,
  },
  feeOptionTextActive: {
    color: colors.gold.champagne,
    fontWeight: '700',
  },
  participantsSection: {
    gap: 10,
  },
  participantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addParticipantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  addParticipantText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
  personCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: 8,
  },
  personTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  personLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  personAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  personAvatarMe: {
    backgroundColor: colors.gold.primary,
    borderColor: colors.gold.primary,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  avatarTextMe: {
    color: '#090A0E',
  },
  personNameInput: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
    paddingVertical: 2,
  },
  personRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  personShareAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gold.champagne,
    letterSpacing: -0.2,
  },
  deletePersonBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  customSubtotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  customSubtotalLabel: {
    fontSize: 12,
    color: colors.text.muted,
  },
  customSubtotalInput: {
    backgroundColor: colors.bg.elevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    minWidth: 100,
    textAlign: 'right',
  },
  roundingNote: {
    fontSize: 10,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  bankInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: 10,
  },
  bankTextInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 13,
    color: colors.text.primary,
  },
  actionsContainer: {
    gap: 10,
    marginTop: 8,
  },
  recordMyShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.gold.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordMyShareText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#090A0E',
  },
  shareWhatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.bg.surface,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  shareWhatsAppText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold.champagne,
  },
});
