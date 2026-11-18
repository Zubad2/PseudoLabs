const EX = [
  [
    "Heights: total, shortest, average (Paper 2 Q5, corrected)",
    "Ann, 160, Bob, 152.5, Cy, 171",
    `DECLARE Names : ARRAY[1:3] OF STRING
DECLARE Heights : ARRAY[1:3] OF REAL
DECLARE Shortest : REAL
DECLARE Total : REAL
DECLARE Counter : INTEGER
DECLARE Index : INTEGER
Shortest ← 500
Index ← 0
Total ← 0
FOR Counter ← 1 TO 3
   INPUT Names[Counter]
   INPUT Heights[Counter]
   Total ← Total + Heights[Counter]
   IF Heights[Counter] < Shortest
      THEN
         Shortest ← Heights[Counter]
         Index ← Counter
   ENDIF
NEXT Counter
OUTPUT "The shortest height is ", Shortest
OUTPUT "The shortest person is ", Names[Index]
OUTPUT "The average height is ", ROUND(Total / 3, 1)`,
  ],
  [
    "Factorial loop (trace table practice)",
    "5, 6, -1",
    `DECLARE Count, Answer, Value : INTEGER
REPEAT
   INPUT Value
   IF Value <> -1
      THEN
         Answer ← Value
         FOR Count ← Value - 1 TO 1 STEP -1
            Answer ← Answer * Count
         NEXT Count
         OUTPUT Answer
   ENDIF
UNTIL Value = -1`,
  ],
  [
    "Bubble sort, descending (flowchart Q9)",
    "",
    `DECLARE List : ARRAY[1:5] OF INTEGER
DECLARE A : BOOLEAN
DECLARE B, T : INTEGER
List[1] ← 15
List[2] ← 17
List[3] ← 20
List[4] ← 5
List[5] ← 9
REPEAT
   A ← FALSE
   FOR B ← 1 TO 4
      IF List[B] < List[B + 1]
         THEN
            T ← List[B]
            List[B] ← List[B + 1]
            List[B + 1] ← T
            A ← TRUE
      ENDIF
   NEXT B
UNTIL A = FALSE
FOR B ← 1 TO 5
   OUTPUT List[B]
NEXT B`,
  ],
  [
    "Calculator with CASE and a function",
    "5, 7, +, 6, 2, -, 4, 3, *, 7, 8, ?, 0, 0, /",
    `FUNCTION Calc(N1 : REAL, N2 : REAL, S : STRING) RETURNS REAL
   CASE OF S
      '+' : RETURN N1 + N2
      '-' : RETURN N1 - N2
      '*' : RETURN N1 * N2
      '/' : RETURN N1 / N2
      OTHERWISE RETURN 0
   ENDCASE
ENDFUNCTION

DECLARE Number1, Number2 : REAL
DECLARE Sign : STRING
INPUT Number1, Number2, Sign
WHILE Number1 <> 0 DO
   OUTPUT Calc(Number1, Number2, Sign)
   INPUT Number1, Number2, Sign
ENDWHILE`,
  ],
];

EX.push(
  [
    "Higher-level syntax: ELSEIF, FOREACH, SWAP, +=",
    "72, 45, 91, 30",
    `DECLARE Marks : ARRAY[1:4] OF INTEGER
DECLARE Grade : STRING
DECLARE Total, Mark, Counter : INTEGER
Total ← 0
FOR Counter ← 1 TO 4
   INPUT Marks[Counter]
NEXT Counter
SWAP Marks[1], Marks[4]
FOREACH Mark IN Marks
   Total += Mark
   IF Mark >= 70
      THEN Grade ← "A"
      ELSEIF Mark >= 50
         THEN Grade ← "B"
         ELSE Grade ← "C"
   ENDIF
   OUTPUT Mark, " scores grade ", Grade
NEXT Mark
SORT(Marks)
OUTPUT "Smallest: ", MIN(Marks), "  Largest: ", MAX(Marks)
OUTPUT "Average: ", Total / SIZE(Marks)`,
  ],
  [
    "Graphics: nested squares",
    "",
    `CANVAS(400, 400)
BACKGROUND("#fffdf5")
DECLARE I : INTEGER
FOR I ← 1 TO 20
   IF I MOD 2 = 0
      THEN COLOUR("#d95f02")
      ELSE COLOUR("#1d6f6a")
   ENDIF
   RECT(200 - I * 9, 200 - I * 9, I * 18, I * 18)
NEXT I
COLOUR("#1b2a49")
TEXT(150, 380, "Nested squares")`,
  ],
);

EX.push(
  [
    "Graphics: sine wave",
    "",
    `CANVAS(480, 240)
BACKGROUND("#fffdf5")
COLOUR("#b9b39d")
LINE(0, 120, 480, 120)
COLOUR("#1b4f9c")
WIDTH(3)
DECLARE X, Y, PrevX, PrevY : REAL
PrevX ← 0
PrevY ← 120
FOR X ← 1 TO 480
   Y ← 120 - SIN(X / 30) * 90
   LINE(PrevX, PrevY, X, Y)
   PrevX ← X
   PrevY ← Y
NEXT X`,
  ],
  [
    "Debug me: heights (5 errors, Paper 2 Q5)",
    "Ann, 160, Bob, 152, Cy, 171",
    `01 DECLARE Names : ARRAY[1:3] OF REAL
02 DECLARE Heights : ARRAY[1:3] OF REAL
03 DECLARE Shortest : REAL
04 DECLARE Total : REAL
05 DECLARE Counter : INTEGER
06 DECLARE Index : INTEGER
07 Shortest ← 500
08 Index ← 0
09 Total ← 100
10 FOR Counter ← 1 TO 3
11    INPUT Names[Index]
12    INPUT Heights[Counter]
13    Total ← Counter + Heights[Counter]
14    IF Heights[Counter] < Shortest
15       THEN
16          Shortest ← Heights[Counter]
17          Index ← Counter
18    ENDIF
19 NEXT Counter
20 OUTPUT "The shortest height is ", Heights
21 OUTPUT "The shortest person is ", Names[Index]
22 OUTPUT "The average height is ", Total / 3`,
  ],
  [
    "Debug me: maximum and minimum (3 errors, Paper 2 Q7)",
    "",
    `DECLARE List : ARRAY[1:5] OF INTEGER
List[1] ← 14
List[2] ← 80
List[3] ← 7
List[4] ← 52
List[5] ← 33
01 Max ← List[1]
02 Min ← List[1]
03 FOR Counter ← 2 TO 5
04     IF List[Counter] < Max
05       THEN
06         Max ← List[Counter]
07     ENDIF
08     IF List[Count] < Min
09       THEN
10         Min ← List[Counter]
11     ENDWHILE
12 NEXT Counter
13 OUTPUT "Maximum value is ", Max
14 OUTPUT "Minimum value is ", Min`,
  ],
);
