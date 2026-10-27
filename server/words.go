package main

import (
	"math/rand/v2"
	"strings"
)

// A starter word list. Swap in a bigger one (or several by difficulty) later.
var wordList = strings.Fields(`
the be to of and a in that have it for not on with he as you do at this but his by
from they we say her she or an will my one all would there their what so up out if
about who get which go me when make can like time no just him know take people into
year your good some could them see other than then now look only come its over think
also back after use two how our work first well way even new want because any these
give day most us great between need large often hand high place hold turn real life
few north open seem together next white children begin got walk example ease paper
group always music those both mark book letter until mile river car feet care second
enough plain girl usual young ready above ever red list though feel talk bird soon
body dog family direct pose leave song measure door product black short numeral class
wind question happen complete ship area half rock order fire south problem piece told
knew pass since top whole king space heard best hour better true during hundred five
remember step early west ground interest reach fast verb sing listen six table travel
less morning ten simple several vowel toward war lay against pattern slow center love
person money serve appear road map rain rule govern pull cold notice voice unit power
town fine certain fly fall lead cry dark machine note wait plan figure star box noun
field rest correct able pound done beauty drive stood contain front teach week final
`)

// generateText returns n random words separated by single spaces.
func generateText(rng *rand.Rand, n int) string {
	words := make([]string, n)
	for i := range words {
		words[i] = wordList[rng.IntN(len(wordList))]
	}
	return strings.Join(words, " ")
}