#!/usr/bin/env python3
# Extracts the algorithms from: https://eprint.iacr.org/2015/1060.pdf
# - Complete addition formulas for prime order elliptic curves
# - Joost Renes, Craig Costello, and Lejla Batina
# Converts to Solidity without the possiblity of introducing transcription errors

from py_ecc import bn128

CURVE_A = 0
CURVE_B = 3
CURVE_FIELD = 0x30644E72E131A029B85045B68181585D97816A916871CA8D3C208C16D87CFD47

altbn254_points = """
1 1 2
2 1368015179489954701390400359078579693043519447331113978918064868415326638035 9918110051302171585080402603319702774565515993150576347155970296011118125764
3 3353031288059533942658390886683067124040920775575537747144343083137631628272 19321533766552368860946552437480515441416830039777911637913418824951667761761
4 3010198690406615200373504922352659861758983907867017329644089018310584441462 4027184618003122424972590350825261965929648733675738730716654005365300998076
5 10744596414106452074759370245733544594153395043370666422502510773307029471145 848677436511517736191562425154572367705380862894644942948681172815252343932
6 4503322228978077916651710446042370109107355802721800704639343137502100212473 6132642251294427119375180147349983541569387941788025780665104001559216576968
7 10415861484417082502655338383609494480414113902179649885744799961447382638712 10196215078179488638353184030336251401353352596818396260819493263908881608606
8 3932705576657793550893430333273221375907985235130430286685735064194643946083 18813763293032256545937756946359266117037834559191913266454084342712532869153
9 1624070059937464756887933993293429854168590106605707304006200119738501412969 3269329550605213075043232856820720631601935657990457502777101397807070461336
10 4444740815889402603535294170722302758225367627362056425101568584910268024244 10537263096529483164618820017164668921386457028564663708352735080900270541420
11 19033251874843656108471242320417533909414939332036131356573128480367742634479 20792135454608030201903199625673964159744755218442260092768620403349374102584
12 17108685722251241369314020928988529881027530433467445791267465866135602972753 20666112440056908034039013737427066139426903072479162670940363761207457724060
13 2672242651313367459976336264061690128665099451055893690004467838496751824703 18247534626997477790812670345925575171672701304065784723769023620148097699216
14 9836339169314901400584090930519505895878753154116006108033708428907043344230 2085718088180884207082818799076507077917184375787335400014805976331012093279
15 20620327752371756597889511849668302065574790742892641857779427155670977738300 13476221886639441297190182883126933680754442408693165714792516739857175455715
16 10835225521862395592687560951453385602895512958032257955899877380493200080708 2623520004791921319615054428233368525468155544765295675952919303096698181037
17 12852522211178622728088728121177131998585782282560100422041774753646305409836 15918672909255108529698304535345707578139606904951176064731093256171019744261
18 20687098839691105097230132006705975099432129393118730698937199498853576759031 2784555085364475896955849729890301289648525422842103121195101376751786827234
19 9642222084729607517877300695132775567109325334448449884825136965142866412173 4237181956005900153121967166075358295245559468450620141848474158744070559022
"""

def extract_test_points(test_points):
	x = test_points.replace("\n", " ").strip().split(" ")
	return {int(_[0]): (int(_[1]), int(_[2])) 
			for _ in zip(*(iter(x),) * 3)}

altbn254_points = extract_test_points(altbn254_points)


# Page 8, Sec 3.1, Algorithm 1: Complete, projective point addition for arbitrary prime order short Weierstrass curves E/Fq : y2 = x3 + ax + b
algorithm_1 = """
1. t0 ← X1 · X2 2. t1 ← Y1 · Y2 3. t2 ← Z1 · Z2
4. t3 ← X1 + Y1 5. t4 ← X2 + Y2 6. t3 ← t3 · t4
7. t4 ← t0 + t1 8. t3 ← t3 − t4 9. t4 ← X1 + Z1
10. t5 ← X2 + Z2 11. t4 ← t4 · t5 12. t5 ← t0 + t2
13. t4 ← t4 − t5 14. t5 ← Y1 + Z1 15. X3 ← Y2 + Z2
16. t5 ← t5 · X3 17. X3 ← t1 + t2 18. t5 ← t5 − X3
19. Z3 ← a · t4 20. X3 ← b3 · t2 21. Z3 ← X3 + Z3
22. X3 ← t1 − Z3 23. Z3 ← t1 + Z3 24. Y3 ← X3 · Z3
25. t1 ← t0 + t0 26. t1 ← t1 + t0 27. t2 ← a · t2
28. t4 ← b3 · t4 29. t1 ← t1 + t2 30. t2 ← t0 − t2
31. t2 ← a · t2 32. t4 ← t4 + t2 33. t0 ← t1 · t4
34. Y3 ← Y3 + t0 35. t0 ← t5 · t4 36. X3 ← t3 · X3
37. X3 ← X3 − t0 38. t0 ← t3 · t1 39. Z3 ← t5 · Z3
40. Z3 ← Z3 + t0
"""

# Page 9, Sec 3.1, Algorithm 2: Complete, mixed point addition for arbitrary prime order short Weierstrass curves E/Fq : y2 = x3 + ax + b
algorithm_2 = """
1. t0 ← X1 · X2 2. t1 ← Y1 · Y2 3. t3 ← X2 + Y2
4. t4 ← X1 + Y1 5. t3 ← t3 · t4 6. t4 ← t0 + t1
7. t3 ← t3 − t4 8. t4 ← X2 · Z1 9. t4 ← t4 + X1
10. t5 ← Y2 · Z1 11. t5 ← t5 + Y1 12. Z3 ← a · t4
13. X3 ← b3 · Z1 14. Z3 ← X3 + Z3 15. X3 ← t1 − Z3
16. Z3 ← t1 + Z3 17. Y3 ← X3 · Z3 18. t1 ← t0 + t0
19. t1 ← t1 + t0 20. t2 ← a · Z1 21. t4 ← b3 · t4
22. t1 ← t1 + t2 23. t2 ← t0 − t2 24. t2 ← a · t2
25. t4 ← t4 + t2 26. t0 ← t1 · t4 27. Y3 ← Y3 + t0
28. t0 ← t5 · t4 29. X3 ← t3 · X3 30. X3 ← X3 − t0
31. t0 ← t3 · t1 32. Z3 ← t5 · Z3 33. Z3 ← Z3 + t0
"""

# Page 10, Sec 3.1, Algorithm 3: Exception-free point doubling for arbitrary prime order short Weierstrass curves E/Fq : y2 = x3 + ax + b
algorithm_3 = """
1. t0 ← X · X 2. t1 ← Y · Y 3. t2 ← Z · Z
4. t3 ← X · Y 5. t3 ← t3 + t3 6. Z3 ← X · Z
7. Z3 ← Z3 + Z3 8. X3 ← a · Z3 9. Y3 ← b3 · t2
10. Y3 ← X3 + Y3 11. X3 ← t1 − Y3 12. Y3 ← t1 + Y3
13. Y3 ← X3 · Y3 14. X3 ← t3 · X3 15. Z3 ← b3 · Z3
16. t2 ← a · t2 17. t3 ← t0 − t2 18. t3 ← a · t3
19. t3 ← t3 + Z3 20. Z3 ← t0 + t0 21. t0 ← Z3 + t0
22. t0 ← t0 + t2 23. t0 ← t0 · t3 24. Y3 ← Y3 + t0
25. t2 ← Y · Z 26. t2 ← t2 + t2 27. t0 ← t2 · t3
28. X3 ← X3 − t0 29. Z3 ← t2 · t1 30. Z3 ← Z3 + Z3
31. Z3 ← Z3 + Z3
"""

# Page 10, Sec 3.2, Algorithm 4: Complete, projective point addition for prime order short Weierstrass curves E/Fq : y2 = x3 + ax + b with a = −3
algorithm_4 = """
1. t0 ← X1 · X2 2. t1 ← Y1 · Y2 3. t2 ← Z1 · Z2
4. t3 ← X1 + Y1 5. t4 ← X2 + Y2 6. t3 ← t3 · t4
7. t4 ← t0 + t1 8. t3 ← t3 − t4 9. t4 ← Y1 + Z1
10. X3 ← Y2 + Z2 11. t4 ← t4 · X3 12. X3 ← t1 + t2
13. t4 ← t4 − X3 14. X3 ← X1 + Z1 15. Y3 ← X2 + Z2
16. X3 ← X3 · Y3 17. Y3 ← t0 + t2 18. Y3 ← X3 − Y3
19. Z3 ← b · t2 20. X3 ← Y3 − Z3 21. Z3 ← X3 + X3
22. X3 ← X3 + Z3 23. Z3 ← t1 − X3 24. X3 ← t1 + X3
25. Y3 ← b · Y3 26. t1 ← t2 + t2 27. t2 ← t1 + t2
28. Y3 ← Y3 − t2 29. Y3 ← Y3 − t0 30. t1 ← Y3 + Y3
31. Y3 ← t1 + Y3 32. t1 ← t0 + t0 33. t0 ← t1 + t0
34. t0 ← t0 − t2 35. t1 ← t4 · Y3 36. t2 ← t0 · Y3
37. Y3 ← X3 · Z3 38. Y3 ← Y3 + t2 39. X3 ← t3 · X3
40. X3 ← X3 − t1 41. Z3 ← t4 · Z3 42. t1 ← t3 · t0
43. Z3 ← Z3 + t1
"""

# Page 11, Sec 3.2, Algorithm 5: Complete, mixed point addition for prime order short Weierstrass curves E/Fq : y2 = x3 + ax + b with a = −3
algorithm_5 = """
1. t0 ← X1 · X2 2. t1 ← Y1 · Y2 3. t3 ← X2 + Y2
4. t4 ← X1 + Y1 5. t3 ← t3 · t4 6. t4 ← t0 + t1
7. t3 ← t3 − t4 8. t4 ← Y2 · Z1 9. t4 ← t4 + Y1
10. Y3 ← X2 · Z1 11. Y3 ← Y3 + X1 12. Z3 ← b · Z1
13. X3 ← Y3 − Z3 14. Z3 ← X3 + X3 15. X3 ← X3 + Z3
16. Z3 ← t1 − X3 17. X3 ← t1 + X3 18. Y3 ← b · Y3
19. t1 ← Z1 + Z1 20. t2 ← t1 + Z1 21. Y3 ← Y3 − t2
22. Y3 ← Y3 − t0 23. t1 ← Y3 + Y3 24. Y3 ← t1 + Y3
25. t1 ← t0 + t0 26. t0 ← t1 + t0 27. t0 ← t0 − t2
28. t1 ← t4 · Y3 29. t2 ← t0 · Y3 30. Y3 ← X3 · Z3
31. Y3 ← Y3 + t2 32. X3 ← t3 · X3 33. X3 ← X3 − t1
34. Z3 ← t4 · Z3 35. t1 ← t3 · t0 36. Z3 ← Z3 + t1
"""

# Page 11, Sec 3.2, Algorithm 6: Exception-free point doubling for prime order short Weierstrass curves E/Fq : y2 = x3 + ax + b with a = −3
algorithm_6 = """
1. t0 ← X · X 2. t1 ← Y · Y 3. t2 ← Z · Z
4. t3 ← X · Y 5. t3 ← t3 + t3 6. Z3 ← X · Z
7. Z3 ← Z3 + Z3 8. Y3 ← b · t2 9. Y3 ← Y3 − Z3
10. X3 ← Y3 + Y3 11. Y3 ← X3 + Y3 12. X3 ← t1 − Y3
13. Y3 ← t1 + Y3 14. Y3 ← X3 · Y3 15. X3 ← X3 · t3
16. t3 ← t2 + t2 17. t2 ← t2 + t3 18. Z3 ← b · Z3
19. Z3 ← Z3 − t2 20. Z3 ← Z3 − t0 21. t3 ← Z3 + Z3
22. Z3 ← Z3 + t3 23. t3 ← t0 + t0 24. t0 ← t3 + t0
25. t0 ← t0 − t2 26. t0 ← t0 · Z3 27. Y3 ← Y3 + t0
28. t0 ← Y · Z 29. t0 ← t0 + t0 30. Z3 ← t0 · Z3
31. X3 ← X3 − Z3 32. Z3 ← t0 · t1 33. Z3 ← Z3 + Z3
34. Z3 ← Z3 + Z3
"""

# Page 12, Sec 3.2, Algorithm 7: Complete, projective point addition for prime order j-invariant 0 short Weierstrass curves E/Fq : y2 = x3 + b
algorithm_7 = """
1. t0 ← X1 · X2 2. t1 ← Y1 · Y2 3. t2 ← Z1 · Z2
4. t3 ← X1 + Y1 5. t4 ← X2 + Y2 6. t3 ← t3 · t4
7. t4 ← t0 + t1 8. t3 ← t3 − t4 9. t4 ← Y1 + Z1
10. X3 ← Y2 + Z2 11. t4 ← t4 · X3 12. X3 ← t1 + t2
13. t4 ← t4 − X3 14. X3 ← X1 + Z1 15. Y3 ← X2 + Z2
16. X3 ← X3 · Y3 17. Y3 ← t0 + t2 18. Y3 ← X3 − Y3
19. X3 ← t0 + t0 20. t0 ← X3 + t0 21. t2 ← b3 · t2
22. Z3 ← t1 + t2 23. t1 ← t1 − t2 24. Y3 ← b3 · Y3
25. X3 ← t4 · Y3 26. t2 ← t3 · t1 27. X3 ← t2 − X3
28. Y3 ← Y3 · t0 29. t1 ← t1 · Z3 30. Y3 ← t1 + Y3
31. t0 ← t0 · t3 32. Z3 ← Z3 · t4 33. Z3 ← Z3 + t0
"""

# Page 13, Sec 4, Algorithm 8: Complete, mixed point addition for prime order j-invariant 0 short Weierstrass curves E/Fq : y2 = x3 + b
algorithm_8 = """
1. t0 ← X1 · X2 2. t1 ← Y1 · Y2 3. t3 ← X2 + Y2
4. t4 ← X1 + Y1 5. t3 ← t3 · t4 6. t4 ← t0 + t1
7. t3 ← t3 − t4 8. t4 ← Y2 · Z1 9. t4 ← t4 + Y1
10. Y3 ← X2 · Z1 11. Y3 ← Y3 + X1 12. X3 ← t0 + t0
13. t0 ← X3 + t0 14. t2 ← b3 · Z1 15. Z3 ← t1 + t2
16. t1 ← t1 − t2 17. Y3 ← b3 · Y3 18. X3 ← t4 · Y3
19. t2 ← t3 · t1 20. X3 ← t2 − X3 21. Y3 ← Y3 · t0
22. t1 ← t1 · Z3 23. Y3 ← t1 + Y3 24. t0 ← t0 · t3
25. Z3 ← Z3 · t4 26. Z3 ← Z3 + t0
"""

# Page 13, Sec 4, Algorithm 9: Exception-free point doubling for prime order j-invariant 0 short Weierstrass curves E/Fq : y2 = x3 + b
algorithm_9 = """
1. t0 ← Y · Y 2. Z3 ← t0 + t0 3. Z3 ← Z3 + Z3
4. Z3 ← Z3 + Z3 5. t1 ← Y · Z 6. t2 ← Z · Z
7. t2 ← b3 · t2 8. X3 ← t2 · Z3 9. Y3 ← t0 + t2
10. Z3 ← t1 · Z3 11. t1 ← t2 + t2 12. t2 ← t1 + t2
13. t0 ← t0 − t2 14. Y3 ← t0 · Y3 15. Y3 ← X3 + Y3
16. t1 ← X · Y 17. X3 ← t0 · t1 18. X3 ← X3 + X3
"""

def alg_to_ops(alg):
	x = alg.replace("\n", " ").strip().split(" ")
	for _ in zip(*(iter(x),) * 6):
		yield _

def inverse(x):
	return pow(x, CURVE_FIELD-2, CURVE_FIELD)

def alg_run(alg, state:dict[str,int]):
	for idx, dest, arrow, var_a, op, var_b in alg_to_ops(alg):
		val_a = state[var_a]
		val_b = state[var_b]
		if op == '·':
			val_c = (val_a * val_b) % CURVE_FIELD
		elif op == '−':
			val_c = (val_a - val_b) % CURVE_FIELD
		elif op == '+':
			val_c = (val_a + val_b) % CURVE_FIELD
		else:
			raise RuntimeError(f'Unknown op @ {idx}: {op}')
		state[dest] = val_c
	return state

def alg_to_solidity(alg, replace):
	for _ in alg_to_ops(alg):
		row = list(_)
		comment = '// ' + ' '.join(row)
		row[1] = replace.get(row[1], row[1])
		row[3] = replace.get(row[3], row[3])
		row[5] = replace.get(row[5], row[5])
		if row[4] == '·':
			op = f'{row[1]} = mulmod({row[3]}, {row[5]}, P);'
		elif row[4] == '−':
			op = f'{row[1]} = submod({row[3]}, {row[5]});'
		elif row[4] == '+':
			op = f'{row[1]} = addmod({row[3]}, {row[5]}, P);'
		else:
			raise RuntimeError('Unknown op', row[4], row)
		yield op, comment

replace = {
}
"""
	'X1': 'A.X',
	'Y1': 'A.Y',
	'Z1': 'A.Z',
	'X2': 'B.X',
	'Y2': 'B.Y',
	'Z2': 'B.Z',
}
"""
for op, comment in alg_to_solidity(algorithm_9, replace):
	print(f'\t\t{op} {comment}')

def point_affine(X, Y, Z):
	zinv = inverse(Z)
	return ((X*zinv) % CURVE_FIELD,(Y*zinv) % CURVE_FIELD)
	
"""
for i in range(1,20):
	for j in range(1,20):
		if i + j not in altbn254_points:
			continue
		X1, Y1 = altbn254_points[i]
		X2, Y2 = altbn254_points[j]
		state = {
			'a': CURVE_A,
			'b': CURVE_B,
			'b3': CURVE_B*3,
			'X1': X1,
			'Y1': Y1,
			'Z1': 1,
			'X2': X2,
			'Y2': Y2,
			'Z2': 1
		}
		after_state = alg_run(algorithm_7, state)
		r = point_affine(state['X3'], state['Y3'], state['Z3'])
		print(i+j)
		print('     alg', r)
		print('elliptic', altbn254_points[i+j])
		P1 = (bn128.FQ(X1), bn128.FQ(Y1))
		P2 = (bn128.FQ(X2), bn128.FQ(Y2))
		print('  py_ecc',bn128.add(P1, P2))
		print()
"""
